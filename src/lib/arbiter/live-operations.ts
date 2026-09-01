import { runScheduleAudit } from '@/lib/arbiter/schedule-intelligence'
import { createAdminClient } from '@/lib/supabase/server'

const clean=(v:unknown)=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const scoreNum=(v:unknown)=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null
const finalish=(v:unknown)=>{const c=clean(v);return c.includes('final')||c.includes('complete')}
const gameToken=(g:any,home:boolean)=>{const t=home?g.home_team_id:g.away_team_id;const e=home?g.external_home_opponent_id:g.external_away_opponent_id;return t?`t:${t}`:e?`e:${e}`:'tba'}
const rowToken=(s:any)=>s?.kind==='internal'&&s?.id?`t:${s.id}`:s?.kind==='external'&&s?.id?`e:${s.id}`:'tba'
const evidenceFingerprint=(r:any)=>{
  const base:any={id:r?.uniqueGameId||null,date:r?.date||null,time:r?.time||null,type:r?.type||null,status:r?.status||null,title:r?.sourcePayload?.title||r?.sourcePayload?.eventTitle||r?.sourcePayload?.description||null,warnings:r?.warnings||[],mappingIssues:r?.mappingIssues||[]}
  // Arbiter can return one round-robin/jamboree event ID with different opponent
  // views depending on which school produced the observation. For title/type
  // conflicts, the admin is adjudicating the event itself, not one opponent view.
  if(clean(r?.bucket)!=='title type conflict'){
    base.home=r?.home?.arbiter||r?.home?.mapped||null
    base.away=r?.away?.arbiter||r?.away?.mapped||null
  }
  return JSON.stringify(base)
}

function orientScores(row:any,game:any){
  const ah=rowToken(row.home),aa=rowToken(row.away),dh=gameToken(game,true),da=gameToken(game,false)
  const hs=scoreNum(row.sourcePayload?.home?.score),as=scoreNum(row.sourcePayload?.away?.score)
  if(hs===null||as===null)return null
  if(ah===dh&&aa===da)return{homeScore:hs,awayScore:as,orientation:'same'}
  if(ah===da&&aa===dh)return{homeScore:as,awayScore:hs,orientation:'reversed'}
  return null
}
function scheduleSeverity(bucket:unknown){const b=clean(bucket);if(b==='orphaned link')return 'blocker';if(['source cancelled','manual review','event sport'].includes(b))return 'info';return 'review'}
function operationalTriage(x:any){
  const k=clean(x?.kind),b=clean(x?.bucket),s=clean(x?.severity),detail=clean(x?.detail),sourceType=clean(x?.sourceType),sourceTitle=clean(x?.sourceTitle)
  // Some Arbiter event IDs represent a multi-participant event and can surface a
  // different opponent view depending on the school observation. Never auto-write
  // that as ordinary opponent drift. Scrimmages and explicitly named relay carnivals
  // are known safe examples and should remain protected/informational.
  if(b==='stable id update'&&detail.includes('opponent orientation mismatch')&&(sourceType==='scrimmage'||sourceTitle.includes('relay carnival')))return 'informational'
  if(s==='blocker'||s==='review')return 'attention'
  if(b==='manual review'||b==='roster missing')return 'waiting'
  if(b==='event sport'||b==='source cancelled')return 'informational'
  if(k==='score')return 'attention'
  return 'informational'
}

export async function runLiveOperationsCheck(seasonId?:string|null){
  const db=createAdminClient(),audit=await runScheduleAudit(seasonId?{seasonId}:{})
  const gameIds=[...new Set((audit.rows||[]).map((r:any)=>r.existingGameId).filter(Boolean))]
  const [{data:games,error:gameError},{data:teamSeasons,error:tsError},{data:teams,error:teamError},{data:sports,error:sportError},{data:rosters,error:rosterError},{data:coaches,error:coachError},{data:resolutions,error:resolutionError}]=await Promise.all([
    gameIds.length?db.from('games').select('id,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id,home_score,away_score,status,source,verification_status,contest_type').in('id',gameIds):Promise.resolve({data:[],error:null} as any),
    db.from('team_seasons').select('team_id,season_id,active_for_season').eq('season_id',audit.season.id).eq('active_for_season',true),
    db.from('teams').select('id,team_name,school_id,sport_id,level,active').eq('active',true),db.from('sports').select('id,sport_name,gender,season_type,slug'),
    db.from('roster_entries').select('team_id,season_id,active,imported_at,source').eq('season_id',audit.season.id).eq('active',true),db.from('team_coaches').select('team_id,season_id,active,imported_at,source').eq('season_id',audit.season.id).eq('active',true),
    db.from('admin_exception_resolutions').select('id,arbiter_game_id,game_id,exception_bucket,resolution,note,evidence_fingerprint,created_at').eq('season_id',audit.season.id).eq('active',true),
  ])
  const err=gameError||tsError||teamError||sportError||rosterError||coachError||resolutionError;if(err)throw new Error(`Fall Operations query failed: ${err.message}`)
  const resolutionById=new Map((resolutions||[]).map((r:any)=>[String(r.arbiter_game_id),r]))
  const resolutionFor=(r:any)=>{const x:any=resolutionById.get(String(r?.uniqueGameId||''));return x&&x.evidence_fingerprint===evidenceFingerprint(r)?x:null}
  const gameById=new Map((games||[]).map((g:any)=>[g.id,g])),scoreRows:any[]=[]
  for(const row of audit.rows||[]){
    const resolution:any=resolutionFor(row);if(!row.existingGameId||clean(row.type)==='scrimmage'||resolution?.resolution==='confirm-scrimmage')continue
    const game=gameById.get(row.existingGameId) as any;if(!game)continue;const oriented=orientScores(row,game);if(!oriented)continue
    const sourceFinal=finalish(row.status),dbHome=scoreNum(game.home_score),dbAway=scoreNum(game.away_score),same=dbHome===oriented.homeScore&&dbAway===oriented.awayScore,blank=dbHome===null&&dbAway===null,arbiterOwned=clean(game.source).startsWith('arbiter')
    let bucket='score-review';if(!sourceFinal)bucket='score-reported-not-final';else if(same)bucket='score-synced';else if(blank)bucket='score-fill';else if(arbiterOwned)bucket='score-update';else bucket='score-conflict'
    scoreRows.push({bucket,arbiterGameId:row.uniqueGameId,gameId:game.id,date:row.date,sport:row.sport,home:row.home?.mapped||row.home?.arbiter,away:row.away?.mapped||row.away?.arbiter,arbiter:{home:oriented.homeScore,away:oriented.awayScore,status:row.status},sectionX:{home:dbHome,away:dbAway,status:game.status,source:game.source,verificationStatus:game.verification_status},safeToApply:['score-fill','score-update'].includes(bucket)})
  }
  const scoreCounts=Object.fromEntries(['score-synced','score-fill','score-update','score-conflict','score-reported-not-final','score-review'].map(k=>[k,scoreRows.filter(r=>r.bucket===k).length]))
  const sportById=new Map((sports||[]).map((s:any)=>[s.id,s])),seasonTeamIds=new Set((teamSeasons||[]).map((x:any)=>x.team_id)),varsityTeams=(teams||[]).filter((t:any)=>seasonTeamIds.has(t.id)&&clean(t.level).includes('varsity')&&!clean(t.level).includes('junior'))
  const rosterCounts=new Map<string,number>(),coachCounts=new Map<string,number>(),latestRoster=new Map<string,string>()
  for(const r of rosters||[]){rosterCounts.set(r.team_id,(rosterCounts.get(r.team_id)||0)+1);if(r.imported_at&&(!latestRoster.get(r.team_id)||r.imported_at>latestRoster.get(r.team_id)!))latestRoster.set(r.team_id,r.imported_at)};for(const c of coaches||[])coachCounts.set(c.team_id,(coachCounts.get(c.team_id)||0)+1)
  const rosterRows=varsityTeams.map((t:any)=>{const s=sportById.get(t.sport_id) as any,rosterCount=rosterCounts.get(t.id)||0,coachCount=coachCounts.get(t.id)||0;return{teamId:t.id,teamName:t.team_name,sport:s?.sport_name||'Unknown',gender:s?.gender||null,rosterCount,coachCount,lastImportedAt:latestRoster.get(t.id)||null,status:rosterCount>0?'loaded':'missing'}}),missingRosters=rosterRows.filter(r=>r.rosterCount===0)
  const schedule={syncedStable:audit.comparison.counts?.['stable-id-match']||0,pendingChanges:audit.comparison.pendingChanges||0,quarantined:audit.comparison.quarantined||0,blockers:audit.comparison.trueBlockers||0,writerReady:Boolean(audit.comparison.writerReady)}
  const rawExceptions=[
    ...(audit.rows||[]).filter((r:any)=>r.quarantined&&r.bucket!=='other-season'&&resolutionFor(r)?.resolution!=='confirm-scrimmage').map((r:any)=>{const resolution:any=resolutionFor(r);return{kind:'schedule',severity:scheduleSeverity(r.bucket),bucket:r.bucket,title:`${r.away?.mapped||r.away?.arbiter} at ${r.home?.mapped||r.home?.arbiter}`,detail:[...(r.mappingIssues||[]),...(r.warnings||[])].join(', '),sourceType:r.type||null,sourceTitle:r.sourcePayload?.title||null,arbiterGameId:r.uniqueGameId,gameId:r.existingGameId||null,evidenceFingerprint:evidenceFingerprint(r),resolution:resolution||null,resolutionEligible:clean(r.bucket)==='title type conflict'}}),
    ...scoreRows.filter(r=>r.bucket==='score-conflict'||r.bucket==='score-review').map(r=>({kind:'score',severity:'review',bucket:r.bucket,title:`${r.away} at ${r.home}`,detail:`Arbiter ${r.arbiter.away}-${r.arbiter.home}; Section X ${r.sectionX.away??'—'}-${r.sectionX.home??'—'}`,arbiterGameId:r.arbiterGameId,gameId:r.gameId})),
    ...missingRosters.map(r=>({kind:'roster',severity:'info',bucket:'roster-missing',title:r.teamName,detail:`${r.sport}${r.gender?` · ${r.gender}`:''}`}))]
  const exceptions=rawExceptions.map((x:any)=>({...x,triage:operationalTriage(x)}))
  const exceptionSummary={blockers:exceptions.filter((x:any)=>x.severity==='blocker').length,review:exceptions.filter((x:any)=>x.severity==='review').length,info:exceptions.filter((x:any)=>x.severity==='info').length,attention:exceptions.filter((x:any)=>x.triage==='attention').length,waiting:exceptions.filter((x:any)=>x.triage==='waiting').length,informational:exceptions.filter((x:any)=>x.triage==='informational').length,total:exceptions.length,resolved:(resolutions||[]).filter((x:any)=>x.resolution==='confirm-scrimmage').length}
  return{ok:true,readOnly:true,checkedAt:new Date().toISOString(),season:audit.season,schedule,scores:{counts:scoreCounts,safeToApply:scoreRows.filter(r=>r.safeToApply).length,conflicts:scoreCounts['score-conflict']||0,rows:scoreRows},rosters:{varsityTeams:rosterRows.length,loaded:rosterRows.length-missingRosters.length,missing:missingRosters.length,rows:rosterRows},exceptions,exceptionSummary,audit}
}
