import { NextRequest,NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'

async function auth(req:NextRequest){return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)}
export async function POST(req:NextRequest){
 if(!await auth(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
 const b=await req.json().catch(()=>null),id=String(b?.id||''),status=String(b?.status||'')
 if(!id||!['pending','approved','rejected','featured'].includes(status))return NextResponse.json({ok:false,error:'Invalid request.'},{status:400})
 const db=createAdminClient()
 const {data,error}=await db.from('fan_top_play_nominations').update({status,admin_notes:String(b?.notes||'').slice(0,500),updated_at:new Date().toISOString()}).eq('id',id).select('*').single()
 if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
 return NextResponse.json({ok:true,item:data})
}
