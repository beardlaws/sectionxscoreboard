import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'
function clean(v:unknown,max:number){return String(v??'').trim().slice(0,max)}
function db(){const {env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}

export async function POST(request:Request){
 try{
  const body=await request.json().catch(()=>null);if(!body)return Response.json({ok:false,error:'Invalid request.'},{status:400})
  const athlete=clean((body as any).athlete_name,140),school=clean((body as any).school_name,160),sport=clean((body as any).sport_name,100),achievement=clean((body as any).achievement,1800),grade=clean((body as any).grade,80),name=clean((body as any).nominator_name,120),email=clean((body as any).nominator_email,200)
  if(!athlete||!school||!sport||!achievement)return Response.json({ok:false,error:'Please fill in all required fields.'},{status:400})
  if(email&&!/^\S+@\S+\.\S+$/.test(email))return Response.json({ok:false,error:'Please enter a valid email.'},{status:400})
  const id=crypto.randomUUID();await db().prepare(`INSERT INTO athlete_nominations (id,athlete_name,school_name,sport_name,grade,achievement,nominator_name,nominator_email,reviewed,created_at) VALUES (?,?,?,?,?,?,?,?,0,datetime('now'))`).bind(id,athlete,school,sport,grade||null,achievement,name||null,email||null).run()
  return Response.json({ok:true,id},{status:201})
 }catch(error){console.error('[nominate]',error);return Response.json({ok:false,error:'Something went wrong. Try again.'},{status:500})}
}
