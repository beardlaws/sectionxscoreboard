import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'
const MAX_BYTES=2*1024*1024
const ALLOWED=new Set(['image/png','image/jpeg','image/webp','image/svg+xml'])
function ext(file:File){if(file.type==='image/png')return'png';if(file.type==='image/webp')return'webp';if(file.type==='image/svg+xml')return'svg';return'jpg'}

export async function POST(request:Request){
 try{
  const form=await request.formData(),file=form.get('file'),schoolId=String(form.get('school_id')||'').trim()
  if(!(file instanceof File)||!schoolId)return Response.json({error:'School and logo file are required.'},{status:400})
  if(!ALLOWED.has(file.type)||file.size<=0||file.size>MAX_BYTES)return Response.json({error:'Logo must be PNG, JPG, WebP, or SVG and 2 MB or smaller.'},{status:400})
  const {env}=getCloudflareContext(),db=(env as any).DB,bucket=(env as any).PHOTOS
  if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
  if(!bucket)return Response.json({error:'Cloudflare R2 storage is not enabled yet.'},{status:503})
  const school:any=await db.prepare('SELECT id,slug,logo_url FROM schools WHERE id=? LIMIT 1').bind(schoolId).first()
  if(!school)return Response.json({error:'School not found.'},{status:404})
  const safeSlug=String(school.slug||school.id).toLowerCase().replace(/[^a-z0-9-]+/g,'-'),key=`schools/${safeSlug}.${ext(file)}`
  await bucket.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:'public, max-age=86400'},customMetadata:{schoolId,originalName:file.name.slice(0,160)}})
  const logoUrl=`/media/photos/${key}`
  await db.prepare(`UPDATE schools SET logo_url=? WHERE id=?`).bind(logoUrl,schoolId).run()
  const previous=String(school.logo_url||'')
  if(previous.startsWith('/media/photos/schools/')&&previous!==logoUrl){const oldKey=previous.replace('/media/photos/','');await bucket.delete(oldKey).catch(()=>null)}
  return Response.json({ok:true,logo_url:logoUrl})
 }catch(error:any){console.error('[admin/schools/logo]',error);return Response.json({error:error?.message||'Logo upload failed.'},{status:500})}
}
