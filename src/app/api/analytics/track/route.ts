import { NextRequest,NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'
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
function db(){const {env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}

export async function POST(req:NextRequest){
 try{
  const body=await req.json(),path=clean(body?.path,1500),visitorId=clean(body?.visitorId,80),sessionId=clean(body?.sessionId,80)
  if(!path||!visitorId||!sessionId||path.startsWith('/admin')||path.startsWith('/api'))return new NextResponse(null,{status:204})
  const ua=req.headers.get('user-agent')||'',referrer=clean(body?.referrer,2000)
  let referrerHost:string|null=null
  if(referrer){try{const host=new URL(referrer).hostname.toLowerCase().replace(/^www\./,'');if(host&&host!=='sectionxscoreboard.com')referrerHost=host}catch{}}
  const utmSource=clean(body?.utmSource,200),utmMedium=clean(body?.utmMedium,200),utmCampaign=clean(body?.utmCampaign,300)
  await db().prepare(`INSERT INTO site_traffic_events (event_name,path,page_title,referrer,referrer_host,session_id,visitor_id,user_agent,is_admin,is_bot,landing_path,source,medium,campaign,device_type,occurred_at) VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,datetime('now'))`)
   .bind('page_view',path,clean(body?.title,500),referrer,referrerHost,sessionId,visitorId,clean(ua,1000),BOT_RE.test(ua)?1:0,clean(body?.landingPath,1500)||path,normalizedSource(referrerHost,utmSource),utmMedium,utmCampaign,device(ua)).run()
 }catch(error){console.error('[analytics/track]',error)}
 return new NextResponse(null,{status:204})
}
