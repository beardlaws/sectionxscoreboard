import { NextRequest,NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'

async function auth(req:NextRequest){return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)}

export async function POST(req:NextRequest){
 if(!await auth(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
 const b=await req.json().catch(()=>null)
 const rankings=Array.isArray(b?.rankings)?[...new Set(b.rankings.map(String))].slice(0,5):[]
 if(!b?.weekStart||!b?.sportId||!b?.groupType||!b?.groupValue)return NextResponse.json({ok:false,error:'Missing poll identity.'},{status:400})
 const db=createAdminClient()
 if(rankings.length){
  const {data:teams}=await db.from('teams').select('id,sport_id').in('id',rankings)
  if((teams||[]).length!==rankings.length||(teams||[]).some((t:any)=>t.sport_id!==b.sportId))return NextResponse.json({ok:false,error:'Invalid team selection.'},{status:400})
 }
 const row={week_start:String(b.weekStart),sport_id:String(b.sportId),group_type:String(b.groupType),group_value:String(b.groupValue),rankings,published:true,updated_at:new Date().toISOString()}
 const {data,error}=await db.from('staff_power_rank_snapshots').upsert(row,{onConflict:'week_start,sport_id,group_type,group_value'}).select('*').single()
 if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
 return NextResponse.json({ok:true,item:data})
}
