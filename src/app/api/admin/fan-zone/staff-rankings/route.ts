import { NextRequest,NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'

async function auth(req:NextRequest){return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)}
function db(){const {env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}

export async function POST(req:NextRequest){
 if(!await auth(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
 const b=await req.json().catch(()=>null)
 const rankings=Array.isArray(b?.rankings)?[...new Set(b.rankings.map(String))].slice(0,5):[]
 if(!b?.weekStart||!b?.sportId||!b?.groupType||!b?.groupValue)return NextResponse.json({ok:false,error:'Missing poll identity.'},{status:400})
 if(!['class','division','all'].includes(String(b.groupType)))return NextResponse.json({ok:false,error:'Invalid ranking group.'},{status:400})
 try{
  const database=db()
  if(rankings.length){
   const placeholders=rankings.map(()=>'?').join(',')
   const found=(await database.prepare(`SELECT id,sport_id FROM teams WHERE id IN (${placeholders})`).bind(...rankings).all()).results||[]
   if(found.length!==rankings.length||found.some((t:any)=>String(t.sport_id)!==String(b.sportId)))return NextResponse.json({ok:false,error:'Invalid team selection.'},{status:400})
  }
  const now=new Date().toISOString(),id=crypto.randomUUID(),rankingsJson=JSON.stringify(rankings)
  await database.prepare(`INSERT INTO staff_power_rank_snapshots (id,week_start,sport_id,group_type,group_value,rankings,published,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?) ON CONFLICT(week_start,sport_id,group_type,group_value) DO UPDATE SET rankings=excluded.rankings,published=1,updated_at=excluded.updated_at`).bind(id,String(b.weekStart),String(b.sportId),String(b.groupType),String(b.groupValue),rankingsJson,now,now).run()
  const item:any=await database.prepare('SELECT * FROM staff_power_rank_snapshots WHERE week_start=? AND sport_id=? AND group_type=? AND group_value=? LIMIT 1').bind(String(b.weekStart),String(b.sportId),String(b.groupType),String(b.groupValue)).first()
  if(item)try{item.rankings=JSON.parse(item.rankings||'[]')}catch{item.rankings=[]}
  return NextResponse.json({ok:true,item})
 }catch(error:any){
  console.error('[admin/fan-zone/staff-rankings]',error)
  return NextResponse.json({ok:false,error:error?.message||'Could not save ranking.'},{status:500})
 }
}
