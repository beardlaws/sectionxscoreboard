import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'
function clean(v:unknown,max:number){return String(v??'').trim().slice(0,max)}
function db(){const {env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}

export async function POST(request:Request){
 try{
  const body=await request.json().catch(()=>null);if(!body)return Response.json({ok:false,error:'Invalid request.'},{status:400})
  const submitterName=clean((body as any).submitter_name,120),description=clean((body as any).description,1000),athleteName=clean((body as any).athlete_name,160),type=clean((body as any).shoutout_type,80),email=clean((body as any).submitter_email,200)
  if(!submitterName||!description||!type)return Response.json({ok:false,error:'Name, type and description are required.'},{status:400})
  if(email&&!/^\S+@\S+\.\S+$/.test(email))return Response.json({ok:false,error:'Please enter a valid email.'},{status:400})
  const id=crypto.randomUUID();await db().prepare(`INSERT INTO shoutouts (id,submitter_name,submitter_email,athlete_name,shoutout_type,description,approved,featured,created_at) VALUES (?,?,?,?,?,?,0,0,datetime('now'))`).bind(id,submitterName,email||null,athleteName||null,type,description).run()
  return Response.json({ok:true,id},{status:201})
 }catch(error){console.error('[shoutout]',error);return Response.json({ok:false,error:'Submission failed. Please try again.'},{status:500})}
}
