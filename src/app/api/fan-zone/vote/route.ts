import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
function weekStart(){const d=new Date(),x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));x.setUTCDate(x.getUTCDate()-((x.getUTCDay()+6)%7));return x.toISOString().slice(0,10)}
function hash(req:NextRequest,salt:string){const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown';return createHash('sha256').update(ip+'|'+(req.headers.get('user-agent')||'')+'|'+salt).digest('hex')}
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null),type=String(b?.type||''),id=String(b?.id||'');if(!id||!['game','school'].includes(type))return NextResponse.json({ok:false,error:'Invalid vote.'},{status:400})
 const db=createAdminClient(),week=weekStart()
 if(type==='game'){
  const {data:g}=await db.from('games').select('id').eq('id',id).maybeSingle();if(!g)return NextResponse.json({ok:false,error:'Game not found.'},{status:404})
  const {error}=await db.from('fan_game_votes').upsert({week_start:week,game_id:id,voter_hash:hash(req,'game'),updated_at:new Date().toISOString()},{onConflict:'week_start,voter_hash'});if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
  const {data:rows}=await db.from('fan_game_votes').select('game_id').eq('week_start',week);const counts=new Map<string,number>();for(const r of rows||[])counts.set(r.game_id,(counts.get(r.game_id)||0)+1)
  for(const [game_id,votes] of counts)await db.from('fan_game_vote_snapshots').upsert({week_start:week,game_id,votes,published:true,updated_at:new Date().toISOString()},{onConflict:'week_start,game_id'})
  return NextResponse.json({ok:true,results:[...counts].map(([id,votes])=>({id,votes})).sort((a,b)=>b.votes-a.votes)})
 }
 const {data:s}=await db.from('schools').select('id').eq('id',id).eq('is_section_x',true).maybeSingle();if(!s)return NextResponse.json({ok:false,error:'School not found.'},{status:404})
 const {error}=await db.from('fan_school_support').upsert({week_start:week,school_id:id,voter_hash:hash(req,'school'),updated_at:new Date().toISOString()},{onConflict:'week_start,voter_hash'});if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
 const {data:rows}=await db.from('fan_school_support').select('school_id').eq('week_start',week);const counts=new Map<string,number>();for(const r of rows||[])counts.set(r.school_id,(counts.get(r.school_id)||0)+1)
 for(const [school_id,votes] of counts)await db.from('fan_school_support_snapshots').upsert({week_start:week,school_id,votes,published:true,updated_at:new Date().toISOString()},{onConflict:'week_start,school_id'})
 return NextResponse.json({ok:true,results:[...counts].map(([id,votes])=>({id,votes})).sort((a,b)=>b.votes-a.votes)})
}