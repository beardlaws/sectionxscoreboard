import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'

function weekStart(d=new Date()){
  const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()))
  const day=x.getUTCDay(); const diff=(day+6)%7
  x.setUTCDate(x.getUTCDate()-diff)
  return x.toISOString().slice(0,10)
}
function clean(v:any,max=300){return String(v||'').trim().slice(0,max)}
function voterHash(req:NextRequest){
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown'
  const ua=req.headers.get('user-agent')||''
  return createHash('sha256').update(ip+'|'+ua+'|sectionx-topplays').digest('hex')
}

export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>null)
  if(!body)return NextResponse.json({ok:false,error:'Invalid request.'},{status:400})
  const athlete=clean(body.athleteName,100),description=clean(body.description,600)
  if(!athlete||!description)return NextResponse.json({ok:false,error:'Athlete and play description are required.'},{status:400})
  const hash=voterHash(req),week=weekStart()
  const db=createAdminClient()
  const {count}=await db.from('fan_top_play_nominations').select('*',{count:'exact',head:true}).eq('week_start',week).eq('voter_hash',hash)
  if((count||0)>=5)return NextResponse.json({ok:false,error:'You have already submitted 5 plays this week.'},{status:429})
  const row={
    week_start:week,athlete_name:athlete,
    school_id:body.schoolId||null,sport_id:body.sportId||null,
    game_date:body.gameDate||null,opponent:clean(body.opponent,120)||null,
    play_description:description,why_top_five:clean(body.whyTopFive,400)||null,
    submitter_name:clean(body.submitterName,100)||null,submitter_email:clean(body.submitterEmail,180)||null,
    voter_hash:hash,status:'pending'
  }
  const {data,error}=await db.from('fan_top_play_nominations').insert(row).select('id').single()
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
  return NextResponse.json({ok:true,id:data.id})
}
