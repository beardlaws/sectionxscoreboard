import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'
function weekStart(d=new Date()){const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));x.setUTCDate(x.getUTCDate()-((x.getUTCDay()+6)%7));return x.toISOString().slice(0,10)}
function clean(v:any,max=300){return String(v||'').trim().slice(0,max)}
function voterHash(req:NextRequest){const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown';return createHash('sha256').update(ip+'|'+(req.headers.get('user-agent')||'')+'|sectionx-topplays').digest('hex')}
function db(){const {env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}

export async function POST(req:NextRequest){
 try{
  const body=await req.json().catch(()=>null);if(!body)return NextResponse.json({ok:false,error:'Invalid request.'},{status:400})
  const athlete=clean(body.athleteName,100),description=clean(body.description,600);if(!athlete||!description)return NextResponse.json({ok:false,error:'Athlete and play description are required.'},{status:400})
  const hash=voterHash(req),week=weekStart(),database=db()
  const count=await database.prepare(`SELECT COUNT(*) AS n FROM fan_top_play_nominations WHERE week_start=? AND voter_hash=?`).bind(week,hash).first()
  if(Number(count?.n||0)>=5)return NextResponse.json({ok:false,error:'You have already submitted 5 plays this week.'},{status:429})
  const id=crypto.randomUUID()
  await database.prepare(`INSERT INTO fan_top_play_nominations (id,week_start,athlete_name,school_id,sport_id,game_date,opponent,play_description,why_top_five,submitter_name,submitter_email,voter_hash,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending',datetime('now'),datetime('now'))`).bind(id,week,athlete,body.schoolId||null,body.sportId||null,body.gameDate||null,clean(body.opponent,120)||null,description,clean(body.whyTopFive,400)||null,clean(body.submitterName,100)||null,clean(body.submitterEmail,180)||null,hash).run()
  return NextResponse.json({ok:true,id},{status:201})
 }catch(error){console.error('[fan-zone/top-plays]',error);return NextResponse.json({ok:false,error:'Could not submit play.'},{status:500})}
}
