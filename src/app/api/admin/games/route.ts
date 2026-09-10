import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

const GAME_COLUMNS = new Set([
  'season_id','sport_id','home_team_id','away_team_id','external_home_opponent_id','external_away_opponent_id',
  'game_date','game_time','location','home_score','away_score','status','verification_status','source','notes',
  'featured','game_of_the_night','rescheduled_date','doubleheader_group_id','game_number','event_name','neutral_site',
  'parser_confidence','contest_type','recap','recap_author','is_playoff','playoff_round','playoff_game_id',
  'result_exempt','result_exempt_reason','league_designation','league_designation_override','league_designation_note',
  'league_designation_updated_at','schedule_override','schedule_override_note','schedule_override_updated_at'
])

function inferredContestType(game:any):'Game'|'Scrimmage'{
  if(String(game?.contest_type||'').toLowerCase()==='scrimmage')return'Scrimmage'
  if(String(game?.notes||'').toLowerCase().includes('arbiter type: scrimmage'))return'Scrimmage'
  return'Game'
}
function slugify(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}
function cleanGame(input:any){
  const out:Record<string,any>={}
  for(const [key,value] of Object.entries(input||{}))if(GAME_COLUMNS.has(key)&&value!==undefined)out[key]=value
  if(!input?.id || input?.contest_type!==undefined || input?.notes!==undefined)out.contest_type=inferredContestType(input)
  if(out.contest_type==='Scrimmage'){
    out.home_score=null;out.away_score=null
    if(out.status==='Final')out.status='Scheduled'
  }
  for(const key of ['featured','game_of_the_night','neutral_site','is_playoff','result_exempt','league_designation_override','schedule_override']){
    if(typeof out[key]==='boolean')out[key]=out[key]?1:0
  }
  return out
}
async function findOrCreateExternalOpponent(db:any,name:string){
  const clean=String(name||'').trim();if(!clean)return null
  const existing:any=await db.prepare('SELECT id FROM external_opponents WHERE lower(name)=lower(?) LIMIT 1').bind(clean).first()
  if(existing?.id)return existing.id
  const id=crypto.randomUUID()
  let slug=slugify(clean)||`opponent-${id.slice(0,8)}`
  const slugExists:any=await db.prepare('SELECT id FROM external_opponents WHERE slug=? LIMIT 1').bind(slug).first()
  if(slugExists)slug=`${slug}-${id.slice(0,8)}`
  await db.prepare("INSERT INTO external_opponents (id,name,slug,is_section_x,created_at) VALUES (?,?,?,0,datetime('now'))").bind(id,clean,slug).run()
  return id
}
async function correctTeamForSport(db:any,teamId:string|null,sportId:string|null){
  if(!teamId||!sportId)return teamId
  const team:any=await db.prepare('SELECT id,sport_id,school_id FROM teams WHERE id=? LIMIT 1').bind(teamId).first()
  if(!team||team.sport_id===sportId)return teamId
  const corrected:any=await db.prepare('SELECT id FROM teams WHERE school_id=? AND sport_id=? AND active=1 ORDER BY CASE WHEN lower(level)=\'varsity\' THEN 0 ELSE 1 END LIMIT 1').bind(team.school_id,sportId).first()
  return corrected?.id||null
}
async function updateGame(db:any,id:string,fields:Record<string,any>){
  const entries=Object.entries(fields).filter(([key])=>GAME_COLUMNS.has(key))
  if(!entries.length)return
  const sql=`UPDATE games SET ${entries.map(([k])=>`${k}=?`).join(',')}, updated_at=datetime('now') WHERE id=?`
  await db.prepare(sql).bind(...entries.map(([,v])=>v),id).run()
}
async function syncPlayoffGame(db:any,gameId:string,fields:Record<string,any>){
  const row:any=await db.prepare('SELECT id FROM playoff_games WHERE game_id=? LIMIT 1').bind(gameId).first()
  if(!row?.id)return
  const updates:Record<string,any>={}
  if(fields.home_score!==undefined)updates.home_score=fields.home_score
  if(fields.away_score!==undefined)updates.away_score=fields.away_score
  if(fields.game_date!==undefined)updates.game_date=fields.game_date
  if(fields.game_time!==undefined)updates.game_time=fields.game_time
  if(fields.location!==undefined)updates.location=fields.location
  if(fields.status!==undefined)updates.status=fields.status==='Final'?'final':fields.status==='Scheduled'?'scheduled':String(fields.status||'').toLowerCase()
  const entries=Object.entries(updates)
  if(!entries.length)return
  await db.prepare(`UPDATE playoff_games SET ${entries.map(([k])=>`${k}=?`).join(',')} WHERE id=?`).bind(...entries.map(([,v])=>v),row.id).run()
}
async function recordImportSource(db:any,p:{gameId:string;teamId:string|null;seasonId:string|null;sportId:string|null;source:string;sourceStatus?:any;sourceGameTime?:any;sourceLocation?:any;sourceContestType?:any;sourceNotes?:any}){
  if(!p.gameId||!p.teamId||!p.seasonId||!p.sportId)return
  const existing:any=await db.prepare('SELECT id FROM game_import_sources WHERE game_id=? AND team_id=? AND season_id=? AND sport_id=? LIMIT 1').bind(p.gameId,p.teamId,p.seasonId,p.sportId).first()
  if(existing?.id){
    await db.prepare(`UPDATE game_import_sources SET source=?,imported_at=datetime('now'),source_status=?,source_game_time=?,source_location=?,source_contest_type=?,source_notes=? WHERE id=?`).bind(p.source,p.sourceStatus??null,p.sourceGameTime??null,p.sourceLocation??null,p.sourceContestType??null,p.sourceNotes??null,existing.id).run()
  }else{
    await db.prepare(`INSERT INTO game_import_sources (id,game_id,team_id,season_id,sport_id,source,imported_at,source_status,source_game_time,source_location,source_contest_type,source_notes) VALUES (?,?,?,?,?,?,datetime('now'),?,?,?,?,?)`).bind(crypto.randomUUID(),p.gameId,p.teamId,p.seasonId,p.sportId,p.source,p.sourceStatus??null,p.sourceGameTime??null,p.sourceLocation??null,p.sourceContestType??null,p.sourceNotes??null).run()
  }
}
async function findDuplicate(db:any,clean:any){
  if(!clean.game_date||!clean.sport_id)return null
  if(!(clean.home_team_id||clean.external_home_opponent_id)||!(clean.away_team_id||clean.external_away_opponent_id))return null
  const sql=`SELECT id,home_team_id,away_team_id,home_score,away_score,status,game_time,location,notes,contest_type,parser_confidence
    FROM games WHERE game_date=? AND sport_id=?
    AND COALESCE(home_team_id,'')=COALESCE(?,'') AND COALESCE(away_team_id,'')=COALESCE(?,'')
    AND COALESCE(external_home_opponent_id,'')=COALESCE(?,'') AND COALESCE(external_away_opponent_id,'')=COALESCE(?,'')
    AND COALESCE(game_number,-1)=COALESCE(?,-1) LIMIT 1`
  return await db.prepare(sql).bind(clean.game_date,clean.sport_id,clean.home_team_id??null,clean.away_team_id??null,clean.external_home_opponent_id??null,clean.external_away_opponent_id??null,clean.game_number??null).first()
}

export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>null)
  if(body==null)return NextResponse.json({error:'Invalid request'},{status:400})
  try{
    const {env}=getCloudflareContext(),db=(env as any).DB
    if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
    const games=Array.isArray(body)?body:Array.isArray(body?.games)?body.games:[body]
    const importTeamId=!Array.isArray(body)?body?.import_team_id||null:null
    const importSource=!Array.isArray(body)?body?.import_source||'manual':'manual'
    const results:any[]=[]

    for(const raw of games){
      const clean=cleanGame(raw)
      if(raw?.external_home_name){clean.external_home_opponent_id=await findOrCreateExternalOpponent(db,raw.external_home_name);clean.home_team_id=null}
      if(raw?.external_away_name){clean.external_away_opponent_id=await findOrCreateExternalOpponent(db,raw.external_away_name);clean.away_team_id=null}
      clean.home_team_id=await correctTeamForSport(db,clean.home_team_id??null,clean.sport_id??null)
      clean.away_team_id=await correctTeamForSport(db,clean.away_team_id??null,clean.sport_id??null)

      if(raw?.id){
        const gameId=String(raw.id)
        const exists:any=await db.prepare('SELECT id FROM games WHERE id=? LIMIT 1').bind(gameId).first()
        if(!exists){results.push({action:'updated',game_id:gameId,error:'Game not found'});continue}
        await updateGame(db,gameId,clean)
        await syncPlayoffGame(db,gameId,clean)
        await recordImportSource(db,{gameId,teamId:importTeamId,seasonId:clean.season_id||null,sportId:clean.sport_id||null,source:importSource,sourceStatus:clean.status,sourceGameTime:clean.game_time,sourceLocation:clean.location,sourceContestType:clean.contest_type,sourceNotes:clean.notes})
        results.push({action:'updated',game_id:gameId});continue
      }

      const existing:any=await findDuplicate(db,clean)
      if(existing){
        const isArbiter=importSource==='arbiter',isHomeSource=!!importTeamId&&clean.home_team_id===importTeamId,authoritative=!isArbiter||isHomeSource
        const mergedContestType=clean.contest_type==='Scrimmage'||existing.contest_type==='Scrimmage'?'Scrimmage':'Game'
        const merged={
          home_score:clean.home_score??existing.home_score??null,
          away_score:clean.away_score??existing.away_score??null,
          status:authoritative?(clean.status??existing.status??'Scheduled'):(existing.status??clean.status??'Scheduled'),
          game_time:authoritative?(clean.game_time??existing.game_time??null):(existing.game_time??clean.game_time??null),
          location:authoritative?(clean.location??existing.location??null):(existing.location??clean.location??null),
          notes:authoritative?(clean.notes??existing.notes??null):(existing.notes??clean.notes??null),
          contest_type:mergedContestType,
          parser_confidence:clean.parser_confidence??existing.parser_confidence??null,
        }
        if(mergedContestType==='Scrimmage'){merged.home_score=null;merged.away_score=null;if(merged.status==='Final')merged.status='Scheduled'}
        await updateGame(db,existing.id,merged)
        await syncPlayoffGame(db,existing.id,merged)
        await recordImportSource(db,{gameId:existing.id,teamId:importTeamId,seasonId:clean.season_id||null,sportId:clean.sport_id||null,source:importSource,sourceStatus:clean.status,sourceGameTime:clean.game_time,sourceLocation:clean.location,sourceContestType:clean.contest_type,sourceNotes:clean.notes})
        results.push({action:'updated',game_id:existing.id});continue
      }

      if(!clean.game_date||!clean.sport_id){results.push({action:'inserted',error:'game_date and sport_id are required'});continue}
      const id=crypto.randomUUID(),entries=Object.entries(clean).filter(([key])=>GAME_COLUMNS.has(key))
      const columns=['id',...entries.map(([k])=>k),'created_at','updated_at']
      const marks=columns.map((_,i)=>i===columns.length-2||i===columns.length-1?"datetime('now')":'?').join(',')
      const values=[id,...entries.map(([,v])=>v)]
      await db.prepare(`INSERT INTO games (${columns.join(',')}) VALUES (${marks})`).bind(...values).run()
      await recordImportSource(db,{gameId:id,teamId:importTeamId,seasonId:clean.season_id||null,sportId:clean.sport_id||null,source:importSource,sourceStatus:clean.status,sourceGameTime:clean.game_time,sourceLocation:clean.location,sourceContestType:clean.contest_type,sourceNotes:clean.notes})
      results.push({action:'inserted',game_id:id})
    }

    return NextResponse.json(Array.isArray(body)?results:{ok:true,results})
  }catch(error:any){
    console.error('[admin/games]',error)
    return NextResponse.json({error:error?.message||'Game write failed'},{status:500})
  }
}
