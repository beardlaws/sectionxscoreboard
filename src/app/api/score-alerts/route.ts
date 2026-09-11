import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'

function getDb(){
  const {env}=getCloudflareContext()
  const db=(env as any).DB
  if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

function emailOf(value:unknown){
  const email=String(value||'').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:''
}

export async function POST(request:Request){
  try{
    const body=await request.json().catch(()=>null)
    const email=emailOf((body as any)?.email)
    const schoolId=(body as any)?.schoolId?String((body as any).schoolId):null
    if(!email)return Response.json({ok:false,error:'Enter a valid email address.'},{status:400})

    const db=getDb()
    if(schoolId){
      const school=await db.prepare('SELECT id FROM schools WHERE id=? LIMIT 1').bind(schoolId).first()
      if(!school)return Response.json({ok:false,error:'School not found.'},{status:404})
    }

    const existing=schoolId
      ? await db.prepare('SELECT id FROM score_alert_subscriptions WHERE lower(email)=lower(?) AND school_id=? LIMIT 1').bind(email,schoolId).first()
      : await db.prepare('SELECT id FROM score_alert_subscriptions WHERE lower(email)=lower(?) AND all_section_x=1 LIMIT 1').bind(email).first()

    if(!existing){
      await db.prepare(`INSERT INTO score_alert_subscriptions (id,email,school_id,all_section_x,confirmed,created_at) VALUES (?,?,?,?,1,datetime('now'))`)
        .bind(crypto.randomUUID(),email,schoolId,schoolId?0:1).run()
    }
    return Response.json({ok:true,existing:Boolean(existing)})
  }catch(error){
    console.error('[score-alerts]',error)
    return Response.json({ok:false,error:'Something went wrong. Try again.'},{status:500})
  }
}
