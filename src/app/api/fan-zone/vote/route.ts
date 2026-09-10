import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'
function weekStart(){const d=new Date(),x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));x.setUTCDate(x.getUTCDate()-((x.getUTCDay()+6)%7));return x.toISOString().slice(0,10)}
function hash(req:NextRequest,salt:string){const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown';return createHash('sha256').update(ip+'|'+(req.headers.get('user-agent')||'')+'|'+salt).digest('hex')}
function db(){const {env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}

async function snapshot(database:any,table:string,idColumn:string,sourceTable:string,week:string){
 const rows=(await database.prepare(`SELECT ${idColumn},COUNT(*) AS votes FROM ${sourceTable} WHERE week_start=? GROUP BY ${idColumn}`).bind(week).all()).results||[]
 for(const row of rows){await database.prepare(`INSERT INTO ${table} (id,week_start,${idColumn},votes,published,updated_at) VALUES (?,?,?,?,1,datetime('now')) ON CONFLICT(week_start,${idColumn}) DO UPDATE SET votes=excluded.votes,published=1,updated_at=datetime('now')`).bind(crypto.randomUUID(),week,(row as any)[idColumn],Number((row as any).votes||0)).run()}
 return rows.map((r:any)=>({id:r[idColumn],votes:Number(r.votes||0)})).sort((a:any,b:any)=>b.votes-a.votes)
}

export async function POST(req:NextRequest){
 try{
  const b=await req.json().catch(()=>null),type=String(b?.type||''),id=String(b?.id||'');if(!id||!['game','school'].includes(type))return NextResponse.json({ok:false,error:'Invalid vote.'},{status:400})
  const database=db(),week=weekStart()
  if(type==='game'){
   const g=await database.prepare(`SELECT id FROM games WHERE id=? LIMIT 1`).bind(id).first();if(!g)return NextResponse.json({ok:false,error:'Game not found.'},{status:404})
   await database.prepare(`INSERT INTO fan_game_votes (id,week_start,game_id,voter_hash,created_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(week_start,voter_hash) DO UPDATE SET game_id=excluded.game_id,updated_at=datetime('now')`).bind(crypto.randomUUID(),week,id,hash(req,'game')).run()
   return NextResponse.json({ok:true,results:await snapshot(database,'fan_game_vote_snapshots','game_id','fan_game_votes',week)})
  }
  const school=await database.prepare(`SELECT id FROM schools WHERE id=? AND is_section_x=1 LIMIT 1`).bind(id).first();if(!school)return NextResponse.json({ok:false,error:'School not found.'},{status:404})
  await database.prepare(`INSERT INTO fan_school_support (id,week_start,school_id,voter_hash,created_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now')) ON CONFLICT(week_start,voter_hash) DO UPDATE SET school_id=excluded.school_id,updated_at=datetime('now')`).bind(crypto.randomUUID(),week,id,hash(req,'school')).run()
  return NextResponse.json({ok:true,results:await snapshot(database,'fan_school_support_snapshots','school_id','fan_school_support',week)})
 }catch(error){console.error('[fan-zone/vote]',error);return NextResponse.json({ok:false,error:'Could not count vote.'},{status:500})}
}
