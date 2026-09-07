import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  let body:any
  try { body = await req.json() } catch { return NextResponse.json({ok:false,error:'Invalid request.'},{status:400}) }
  if (!body?.title || !body?.slug || !body?.published_date || (!body?.facebook_embed_url && !body?.facebook_url)) return NextResponse.json({ok:false,error:'Title, date, and Facebook video are required.'},{status:400})
  const db=createAdminClient()
  await db.from('weekly_recaps').update({featured:false}).eq('featured',true)
  const {data,error}=await db.from('weekly_recaps').insert({title:String(body.title).slice(0,180),slug:String(body.slug).slice(0,180),summary:body.summary?String(body.summary).slice(0,1000):null,published_date:body.published_date,season_label:body.season_label?String(body.season_label).slice(0,80):null,week_label:body.week_label?String(body.week_label).slice(0,80):null,facebook_url:body.facebook_url||null,facebook_embed_url:body.facebook_embed_url||null,published:true,featured:true}).select('id,slug').single()
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
  return NextResponse.json({ok:true,recap:data})
}
