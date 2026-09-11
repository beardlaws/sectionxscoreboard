import { NextRequest,NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'
import { GET as runCloudflareArbiterPull } from '@/app/api/cron/arbiter-pull/route'

export const dynamic='force-dynamic'
export const maxDuration=300

export async function POST(req:NextRequest){
  const isAdmin=await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)
  if(!isAdmin)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})

  const {env}=getCloudflareContext()
  const automationKey=String((env as any).SECTIONX_AUTOMATION_KEY||(env as any).CRON_SECRET||process.env.SECTIONX_AUTOMATION_KEY||process.env.CRON_SECRET||'')
  if(!automationKey)return NextResponse.json({ok:false,error:'Cloudflare automation key is not configured.'},{status:503})

  const internalReq=new NextRequest(new URL('/api/cron/arbiter-pull',req.url),{
    method:'GET',
    headers:{'x-sectionx-automation-key':automationKey}
  })
  const result=await runCloudflareArbiterPull(internalReq)
  const payload=await result.json().catch(()=>({ok:false,error:'Arbiter refresh returned an unreadable response.'}))
  return NextResponse.json({...payload,manual:true},{status:result.status})
}
