import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { GET as scanRosters } from '@/app/api/admin/arbiter-api/roster-scan/route'
import { POST as importRosters } from '@/app/api/admin/arbiter-rosters/route'

export const dynamic='force-dynamic'
export const maxDuration=300

const norm=(v:unknown)=>String(v??'')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,' ')
  .replace(/\s+/g,' ')
  .trim()

const val=(v:unknown)=>String(v??'').replace(/\s+/g,' ').trim()

function rosterRecord(row:any){
  const athlete=Array.isArray(row?.athlete)?row.athlete[0]:row?.athlete
  return {name:norm(athlete?.display_name),jersey:val(row?.jersey_number),classYear:val(row?.class_year),position:val(row?.position),height:val(row?.height)}
}
function incomingRosterRecord(row:any){return{name:norm(row?.displayName),jersey:val(row?.jerseyNumber),classYear:val(row?.classYear),position:val(row?.position),height:val(row?.height)}}
function coachRecord(row:any){const coach=Array.isArray(row?.coach)?row.coach[0]:row?.coach;return{name:norm(coach?.display_name),title:val(row?.title)}}
function incomingCoachRecord(row:any){return{name:norm(row?.displayName),title:val(row?.title)}}
function sig(row:any){return[row.name,row.jersey||'',row.classYear||'',row.position||'',row.height||''].join('|')}
function coachSig(row:any){return[row.name,row.title||''].join('|')}
function duplicates(rows:any[]){const seen=new Set<string>(),dups=new Set<string>();for(const row of rows){if(!row.name)continue;if(seen.has(row.name))dups.add(row.name);seen.add(row.name)}return[...dups]}
function comparePeople(current:any[],incoming:any[],type:'roster'|'coach'){
  const currentClean=current.filter(r=>r.name),incomingClean=incoming.filter(r=>r.name),currentNames=new Set(currentClean.map(r=>r.name)),incomingNames=new Set(incomingClean.map(r=>r.name)),removed=[...currentNames].filter(name=>!incomingNames.has(name)),added=[...incomingNames].filter(name=>!currentNames.has(name)),dupes=duplicates(incomingClean)
  const maxReasonable=type==='roster'?(currentClean.length===0?60:Math.max(currentClean.length*2+10,60)):(currentClean.length===0?15:Math.max(currentClean.length*2+5,15)),implausible=incomingClean.length>maxReasonable,currentMap=new Map(currentClean.map(r=>[r.name,type==='roster'?sig(r):coachSig(r)])),incomingMap=new Map(incomingClean.map(r=>[r.name,type==='roster'?sig(r):coachSig(r)])),metadataChanged=[...incomingNames].filter(name=>currentMap.has(name)&&currentMap.get(name)!==incomingMap.get(name)),safe=removed.length===0&&dupes.length===0&&!implausible,changed=safe&&(added.length>0||metadataChanged.length>0||currentClean.length!==incomingClean.length)
  return{safe,changed,removed,added,dupes,metadataChanged,implausible,currentCount:currentClean.length,incomingCount:incomingClean.length}
}

export async function GET(req:NextRequest){
  const db=createAdminClient(),token=req.headers.get('x-sectionx-automation-key')||''
  const {data:allowed,error:authError}=await db.rpc('verify_sectionx_automation_key',{p_token:token})
  if(authError||allowed!==true)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const staleCutoff=new Date(Date.now()-20*60_000).toISOString(),{data:running}=await db.from('arbiter_roster_automation_runs').select('id,started_at').eq('status','running').gte('started_at',staleCutoff).order('started_at',{ascending:false}).limit(1).maybeSingle()
  if(running?.id)return NextResponse.json({ok:false,error:'An automated roster reconciliation is already running.',runId:running.id},{status:409})
  const {data:run,error:runError}=await db.from('arbiter_roster_automation_runs').insert({status:'running',trigger_source:'supabase-roster-cron'}).select('id').single()
  if(runError)return NextResponse.json({ok:false,error:`Could not start roster automation: ${runError.message}`},{status:500})
  const runId=run.id
  try{
    const {data:season,error:seasonError}=await db.from('seasons').select('id,name,season_type,year,is_active').eq('is_active',true).limit(1).maybeSingle()
    if(seasonError||!season)throw new Error(seasonError?.message||'No active season found.')
    const scanReq=new NextRequest(`http://sectionx.internal/api/admin/arbiter-api/roster-scan?seasonId=${encodeURIComponent(season.id)}`),scanResponse=await scanRosters(scanReq),scan:any=await scanResponse.json()
    if(!scanResponse.ok||!scan?.ok)throw new Error(scan?.error||`Roster scan failed with HTTP ${scanResponse.status}.`)
    const payloads:any[]=Array.isArray(scan.importPayloads)?scan.importPayloads:[],teamIds=payloads.map((p:any)=>p.team_id).filter(Boolean)
    const [{data:currentRoster,error:rosterError},{data:currentCoaches,error:coachError}]=await Promise.all([
      teamIds.length?db.from('roster_entries').select('team_id,jersey_number,class_year,position,height,athlete:athletes(display_name)').eq('season_id',season.id).eq('source','arbiter').eq('active',true).in('team_id',teamIds):Promise.resolve({data:[],error:null} as any),
      teamIds.length?db.from('team_coaches').select('team_id,title,coach:coaches(display_name)').eq('season_id',season.id).eq('source','arbiter').eq('active',true).in('team_id',teamIds):Promise.resolve({data:[],error:null} as any),
    ])
    if(rosterError)throw new Error(`Current roster read failed: ${rosterError.message}`)
    if(coachError)throw new Error(`Current coach read failed: ${coachError.message}`)
    const rosterByTeam=new Map<string,any[]>(),coachesByTeam=new Map<string,any[]>()
    for(const row of currentRoster||[]){const list=rosterByTeam.get((row as any).team_id)||[];list.push(rosterRecord(row));rosterByTeam.set((row as any).team_id,list)}
    for(const row of currentCoaches||[]){const list=coachesByTeam.get((row as any).team_id)||[];list.push(coachRecord(row));coachesByTeam.set((row as any).team_id,list)}
    const safePayloads:any[]=[],actions:any[]=[],quarantines:any[]=[]
    let unchanged=0,athletesAdded=0,athleteMetadataUpdated=0,coachesAdded=0,coachMetadataUpdated=0
    for(const payload of payloads){
      const currentR=rosterByTeam.get(payload.team_id)||[],incomingR=(payload.roster||[]).map(incomingRosterRecord),currentC=coachesByTeam.get(payload.team_id)||[],incomingC=(payload.coaches||[]).map(incomingCoachRecord)
      const rosterCmp=payload.roster_found===true?comparePeople(currentR,incomingR,'roster'):{safe:false,changed:false,removed:[],added:[],dupes:[],metadataChanged:[],implausible:false,currentCount:currentR.length,incomingCount:0}
      const coachCmp=payload.coaches_found===true?comparePeople(currentC,incomingC,'coach'):{safe:false,changed:false,removed:[],added:[],dupes:[],metadataChanged:[],implausible:false,currentCount:currentC.length,incomingCount:0}
      if(payload.roster_found===true&&!rosterCmp.safe)quarantines.push({teamId:payload.team_id,area:'roster',reason:rosterCmp.dupes.length?'duplicate-athlete-names':rosterCmp.implausible?'implausible-roster-size':'roster-removal-or-replacement',currentCount:rosterCmp.currentCount,incomingCount:rosterCmp.incomingCount,removed:rosterCmp.removed.slice(0,20),duplicates:rosterCmp.dupes.slice(0,20)})
      if(payload.coaches_found===true&&!coachCmp.safe)quarantines.push({teamId:payload.team_id,area:'coaches',reason:coachCmp.dupes.length?'duplicate-coach-names':coachCmp.implausible?'implausible-coach-size':'coach-removal-or-replacement',currentCount:coachCmp.currentCount,incomingCount:coachCmp.incomingCount,removed:coachCmp.removed.slice(0,20),duplicates:coachCmp.dupes.slice(0,20)})
      const rosterWrite=payload.roster_found===true&&rosterCmp.safe&&rosterCmp.changed,coachWrite=payload.coaches_found===true&&coachCmp.safe&&coachCmp.changed
      if(!rosterWrite&&!coachWrite){unchanged++;continue}
      safePayloads.push({...payload,roster_found:rosterWrite,coaches_found:coachWrite,roster:rosterWrite?payload.roster:[],coaches:coachWrite?payload.coaches:[]})
      athletesAdded+=rosterWrite?rosterCmp.added.length:0;athleteMetadataUpdated+=rosterWrite?rosterCmp.metadataChanged.length:0;coachesAdded+=coachWrite?coachCmp.added.length:0;coachMetadataUpdated+=coachWrite?coachCmp.metadataChanged.length:0
      actions.push({teamId:payload.team_id,roster:rosterWrite?{added:rosterCmp.added.length,metadataUpdated:rosterCmp.metadataChanged.length,newCount:rosterCmp.incomingCount}:null,coaches:coachWrite?{added:coachCmp.added.length,metadataUpdated:coachCmp.metadataChanged.length,newCount:coachCmp.incomingCount}:null})
    }
    let teamsUpdated=0,failed=0;const failures:any[]=[]
    for(let i=0;i<safePayloads.length;i+=3){
      const batch=safePayloads.slice(i,i+3),importReq=new NextRequest('http://sectionx.internal/api/admin/arbiter-rosters',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({teams:batch})}),response=await importRosters(importReq),result:any=await response.json(),resultRows=Array.isArray(result?.results)?result.results:[]
      teamsUpdated+=resultRows.filter((r:any)=>!Array.isArray(r.errors)||r.errors.length===0).length
      const batchErrors=[...(Array.isArray(result?.errors)?result.errors:[]),...resultRows.flatMap((r:any)=>(r.errors||[]).map((message:string)=>({teamId:r.team_id,message})))]
      if(!response.ok||result?.success===false||batchErrors.length){failed+=Math.max(1,batchErrors.length);failures.push(...batchErrors.slice(0,25))}
    }
    const summary={season:{id:season.id,name:season.name},scanned:Number(scan.counts?.teams||0),published:Number(scan.counts?.available||0),alreadyLoaded:Number(scan.counts?.alreadyLoaded||0),teamsUpdated,safeTeams:safePayloads.length,unchanged,athletesAdded,athleteMetadataUpdated,coachesAdded,coachMetadataUpdated,quarantined:quarantines.length,failed,scanWarnings:{notPublished:Number(scan.counts?.noRosterPublished||0),unmatched:Number(scan.counts?.teamNotFound||0)+Number(scan.counts?.arbiterNoTeams||0),ambiguous:Number(scan.counts?.ambiguous||0),apiErrors:Number(scan.counts?.errors||0)},actions:actions.slice(0,50),quarantines:quarantines.slice(0,50),failures:failures.slice(0,50)}
    const status=failed?'completed-with-errors':'completed'
    await db.from('arbiter_roster_automation_runs').update({status,season_id:season.id,summary,finished_at:new Date().toISOString()}).eq('id',runId)
    return NextResponse.json({ok:failed===0,automated:true,runId,...summary},{status:failed?207:200})
  }catch(error){
    const message=error instanceof Error?error.message:String(error)
    console.error('Automated Arbiter roster reconciliation failed:',error)
    await db.from('arbiter_roster_automation_runs').update({status:'failed',summary:{error:message},finished_at:new Date().toISOString()}).eq('id',runId)
    return NextResponse.json({ok:false,automated:true,runId,error:message},{status:500})
  }
}
