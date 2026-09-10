import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'
function weekStart(d=new Date()){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));x.setUTCDate(x.getUTCDate()-((x.getUTCDay()+6)%7));return x.toISOString().slice(0,10)}
function voterHash(req:NextRequest){const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown';return createHash('sha256').update(ip+'|'+(req.headers.get('user-agent')||'')+'|sectionx-powerrank').digest('hex')}
function db(){const {env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}

export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null),rankings=Array.isArray(body?.rankings)?body.rankings.map(String):[],unique=[...new Set(rankings)]
  if(!body?.sportId||!body?.groupType||!body?.groupValue||unique.length<1||unique.length>5)return NextResponse.json({ok:false,error:'Rank between one and five different teams.'},{status:400})
  const database=db(),placeholders=unique.map(()=>'?').join(','),teamsRes=await database.prepare(`SELECT id,sport_id FROM teams WHERE id IN (${placeholders})`).bind(...unique).all(),teams=teamsRes.results||[]
  if(teams.length!==unique.length||teams.some((t:any)=>t.sport_id!==String(body.sportId)))return NextResponse.json({ok:false,error:'Invalid teams for this sport.'},{status:400})
  const week=weekStart(),sportId=String(body.sportId),groupType=String(body.groupType).slice(0,40),groupValue=String(body.groupValue).slice(0,80),hash=voterHash(req),id=crypto.randomUUID(),rankingsJson=JSON.stringify(unique)
  await database.prepare(`INSERT INTO fan_power_rank_ballots (id,week_start,sport_id,group_type,group_value,rankings,voter_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(week_start,sport_id,group_type,group_value,voter_hash) DO UPDATE SET rankings=excluded.rankings,updated_at=datetime('now')`).bind(id,week,sportId,groupType,groupValue,rankingsJson,hash).run()
  const ballotRes=await database.prepare(`SELECT rankings FROM fan_power_rank_ballots WHERE week_start=? AND sport_id=? AND group_type=? AND group_value=?`).bind(week,sportId,groupType,groupValue).all(),ballots=ballotRes.results||[]
  const points=new Map<string,number>(),votes=new Map<string,number>(),firsts=new Map<string,number>()
  for(const b of ballots){let arr:any[]=[];try{arr=JSON.parse(String((b as any).rankings||'[]'))}catch{};arr.slice(0,5).forEach((teamId:string,i:number)=>{points.set(teamId,(points.get(teamId)||0)+(5-i));votes.set(teamId,(votes.get(teamId)||0)+1);if(i===0)firsts.set(teamId,(firsts.get(teamId)||0)+1)})}
  const ids=[...points.keys()];let names:any[]=[]
  if(ids.length){const ps=ids.map(()=>'?').join(','),r=await database.prepare(`SELECT t.id,t.team_name,s.school_name,s.slug FROM teams t LEFT JOIN schools s ON s.id=t.school_id WHERE t.id IN (${ps})`).bind(...ids).all();names=r.results||[]}
  const byId=new Map(names.map((t:any)=>[t.id,t])),results=ids.map(teamId=>{const t:any=byId.get(teamId);return{teamId,teamName:t?.school_name||t?.team_name||'Team',slug:t?.slug||null,points:points.get(teamId)||0,votes:votes.get(teamId)||0,firstPlaceVotes:firsts.get(teamId)||0}}).sort((a,b)=>b.points-a.points||b.votes-a.votes||a.teamName.localeCompare(b.teamName))
  await database.prepare(`INSERT INTO fan_power_rank_snapshots (id,week_start,sport_id,group_type,group_value,results,ballot_count,published,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,datetime('now'),datetime('now')) ON CONFLICT(week_start,sport_id,group_type,group_value) DO UPDATE SET results=excluded.results,ballot_count=excluded.ballot_count,published=1,updated_at=datetime('now')`).bind(crypto.randomUUID(),week,sportId,groupType,groupValue,JSON.stringify(results),ballots.length).run()
  return NextResponse.json({ok:true,ballotCount:ballots.length,results})
 }catch(error){console.error('[fan-zone/power-rankings]',error);return NextResponse.json({ok:false,error:'Could not submit ranking.'},{status:500})}
}
