import { NextRequest,NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
export const runtime='nodejs'
const BOT_RE=/bot|crawler|spider|crawling|headless|lighthouse|pagespeed|google-inspectiontool|facebookexternalhit|slurp|bingpreview|cloudflare|uptime|monitor/i
function clean(v:unknown,max=1000){return typeof v==='string'&&v.trim()?v.slice(0,max):null}
function device(ua:string){if(/ipad|tablet|kindle|silk/i.test(ua))return 'Tablet';if(/mobi|iphone|android/i.test(ua))return 'Mobile';return 'Desktop'}
function normalizedSource(host:string|null,utm:string|null){
 if(utm)return utm
 if(!host)return 'Direct / Private Referral'
 if(['l.instagram.com','instagram.com'].includes(host))return 'Instagram'
 if(['l.facebook.com','lm.facebook.com','facebook.com','m.facebook.com'].includes(host))return 'Facebook'
 if(host.includes('google.'))return 'Google'
 if(host==='northcountrynow.com')return 'North Country Now'
 return host
}
export async function POST(req:NextRequest){
 try{
  const body=await req.json(),path=clean(body?.path,1500),visitorId=clean(body?.visitorId,80),sessionId=clean(body?.sessionId,80)
  if(!path||!visitorId||!sessionId||path.startsWith('/admin')||path.startsWith('/api'))return new NextResponse(null,{status:204})
  const ua=req.headers.get('user-agent')||'',referrer=clean(body?.referrer,2000)
  let referrerHost:string|null=null
  if(referrer){try{const host=new URL(referrer).hostname.toLowerCase().replace(/^www\./,'');if(host&&host!=='sectionxscoreboard.com')referrerHost=host}catch{}}
  const utmSource=clean(body?.utmSource,200),utmMedium=clean(body?.utmMedium,200),utmCampaign=clean(body?.utmCampaign,300)
  const supabase=createAdminClient()
  await supabase.from('site_traffic_events').insert({event_name:'page_view',path,page_title:clean(body?.title,500),referrer,referrer_host:referrerHost,session_id:sessionId,visitor_id:visitorId,user_agent:clean(ua,1000),is_admin:false,is_bot:BOT_RE.test(ua),landing_path:clean(body?.landingPath,1500)||path,source:normalizedSource(referrerHost,utmSource),medium:utmMedium,campaign:utmCampaign,device_type:device(ua)})
 }catch{}
 return new NextResponse(null,{status:204})
}
