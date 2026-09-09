import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

function weekStart(d=new Date()){
  const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()))
  const diff=(x.getUTCDay()+6)%7;x.setUTCDate(x.getUTCDate()-diff)
  return x.toISOString().slice(0,10)
}
function voterHash(req:NextRequest){
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown'
  const ua=req.headers.get('user-agent')||''
  return createHash('sha256').update(ip+'|'+ua+'|sectionx-powerrank').digest('hex')
}
export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>null)
  const rankings=Array.isArray(body?.rankings)?body.rankings.map(String):[]
  const unique=[...new Set(rankings)]
  if(!body?.sportId||!body?.groupType||!body?.groupValue||unique.length<1||unique.length>5)return NextResponse.json({ok:false,error:'Rank between one and five different teams.'},{status:400})
  const db=createAdminClient()
  const {data:teams}=await db.from('teams').select('id,sport_id').in('id',unique)
  if((teams||[]).length!==unique.length||(teams||[]).some((t:any)=>t.sport_id!==body.sportId))return NextResponse.json({ok:false,error:'Invalid teams for this sport.'},{status:400})
  const row={week_start:weekStart(),sport_id:String(body.sportId),group_type:String(body.groupType),group_value:String(body.groupValue),rankings:unique,voter_hash:voterHash(req),updated_at:new Date().toISOString()}
  const {error}=await db.from('fan_power_rank_ballots').upsert(row,{onConflict:'week_start,sport_id,group_type,group_value,voter_hash'})
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500})

  const {data:ballots}=await db.from('fan_power_rank_ballots').select('rankings').eq('week_start',row.week_start).eq('sport_id',row.sport_id).eq('group_type',row.group_type).eq('group_value',row.group_value)
  const points=new Map<string,number>(),votes=new Map<string,number>(),firsts=new Map<string,number>()
  for(const b of ballots||[]){const arr=Array.isArray(b.rankings)?b.rankings:[];arr.slice(0,5).forEach((id:string,i:number)=>{points.set(id,(points.get(id)||0)+(5-i));votes.set(id,(votes.get(id)||0)+1)})}
  const ids=[...points.keys()],{data:names}=ids.length?await db.from('teams').select('id,team_name,school:schools(school_name,slug)').in('id',ids):{data:[]}
  const byId=new Map((names||[]).map((t:any)=>[t.id,t]))
  const results=ids.map(id=>{const t:any=byId.get(id),school=Array.isArray(t?.school)?t.school[0]:t?.school;return{teamId:id,teamName:school?.school_name||t?.team_name||'Team',slug:school?.slug||null,points:points.get(id)||0,votes:votes.get(id)||0,firstPlaceVotes:firsts.get(id)||0}}).sort((a,b)=>b.points-a.points||b.votes-a.votes||a.teamName.localeCompare(b.teamName))
  await db.from('fan_power_rank_snapshots').upsert({week_start:row.week_start,sport_id:row.sport_id,group_type:row.group_type,group_value:row.group_value,results,ballot_count:(ballots||[]).length,published:true,updated_at:new Date().toISOString()},{onConflict:'week_start,sport_id,group_type,group_value'})
  return NextResponse.json({ok:true,ballotCount:(ballots||[]).length,results})
}
