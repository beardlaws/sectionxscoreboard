import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
function db(){const {env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}

export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value, process.env.ADMIN_SESSION_TOKEN)
  if (!isAdmin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  let body:any
  try { body = await req.json() } catch { return NextResponse.json({ok:false,error:'Invalid request.'},{status:400}) }
  if (!body?.title || !body?.slug || !body?.published_date || (!body?.facebook_embed_url && !body?.facebook_url)) return NextResponse.json({ok:false,error:'Title, date, and Facebook video are required.'},{status:400})
  try{
    const database=db(),id=crypto.randomUUID(),now=new Date().toISOString()
    await database.batch([
      database.prepare('UPDATE weekly_recaps SET featured=0,updated_at=? WHERE featured=1').bind(now),
      database.prepare(`INSERT INTO weekly_recaps (id,title,slug,summary,published_date,season_label,week_label,facebook_url,facebook_embed_url,published,featured,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,1,?,?)`).bind(id,String(body.title).slice(0,180),String(body.slug).slice(0,180),body.summary?String(body.summary).slice(0,1000):null,String(body.published_date),body.season_label?String(body.season_label).slice(0,80):null,body.week_label?String(body.week_label).slice(0,80):null,body.facebook_url||null,body.facebook_embed_url||null,now,now)
    ])
    return NextResponse.json({ok:true,recap:{id,slug:String(body.slug).slice(0,180)}})
  }catch(error:any){
    console.error('[admin/weekly-recap]',error)
    return NextResponse.json({ok:false,error:error?.message||'Could not save recap.'},{status:500})
  }
}
