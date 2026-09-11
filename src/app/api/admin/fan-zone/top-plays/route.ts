import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest,NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'

async function auth(req:NextRequest){return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)}
function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function POST(req:NextRequest){
 if(!await auth(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
 const b=await req.json().catch(()=>null),id=String(b?.id||''),status=String(b?.status||'')
 if(!id||!['pending','approved','rejected','featured'].includes(status))return NextResponse.json({ok:false,error:'Invalid request.'},{status:400})
 try{
  const db=getDb(),now=new Date().toISOString(),notes=String(b?.notes||'').slice(0,500)
  const result=await db.prepare('UPDATE fan_top_play_nominations SET status=?,admin_notes=?,updated_at=? WHERE id=?').bind(status,notes,now,id).run()
  if(!result.meta?.changes)return NextResponse.json({ok:false,error:'Nomination not found.'},{status:404})
  const item=await db.prepare('SELECT * FROM fan_top_play_nominations WHERE id=? LIMIT 1').bind(id).first()
  return NextResponse.json({ok:true,item})
 }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'Could not update nomination.'},{status:500})}
}
