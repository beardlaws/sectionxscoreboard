import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { env } = getCloudflareContext()
    const db = (env as any).DB
    const photos = (env as any).PHOTOS
    if (!db || !photos) return Response.json({ok:false,d1:Boolean(db),r2:Boolean(photos)},{status:503})
    const d1:any = await db.prepare(`SELECT (SELECT COUNT(*) FROM photos) AS photos,(SELECT COUNT(*) FROM submissions) AS submissions`).first()
    const listed:any = await photos.list({limit:1})
    return Response.json({ok:true,d1:{photos:Number(d1?.photos||0),submissions:Number(d1?.submissions||0)},r2:{connected:true,hasObjects:Boolean(listed?.objects?.length)}})
  } catch (error) {
    console.error('[cloudflare-storage-health]',error)
    return Response.json({ok:false,error:'Storage health check failed.'},{status:500})
  }
}
