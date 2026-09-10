import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { env } = getCloudflareContext()
    const db = (env as any).DB
    const photos = (env as any).PHOTOS
    if (!db) return Response.json({ok:false,d1:false,r2:Boolean(photos),error:'D1 binding missing'},{status:503})

    const [games,schools,photosRow] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS count FROM games').first(),
      db.prepare('SELECT COUNT(*) AS count FROM schools').first(),
      db.prepare('SELECT COUNT(*) AS count FROM photos').first(),
    ])

    return Response.json({
      ok:true,
      d1:true,
      r2:Boolean(photos),
      counts:{
        games:Number((games as any)?.count||0),
        schools:Number((schools as any)?.count||0),
        photos:Number((photosRow as any)?.count||0),
      },
      backend:'cloudflare',
    },{headers:{'cache-control':'no-store'}})
  } catch (error) {
    console.error('[cloudflare-readiness]',error)
    return Response.json({ok:false,error:'Cloudflare readiness check failed.'},{status:500})
  }
}
