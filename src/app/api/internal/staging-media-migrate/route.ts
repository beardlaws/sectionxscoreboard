import { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const CONFIRM = 'staging-media-migration'
const BATCH = 20

function isWorkersDevHost(host: string) {
  const h = host.toLowerCase().split(':')[0]
  return h.endsWith('.workers.dev')
}

function extForType(type: string, fallback = 'jpg') {
  const t = type.toLowerCase()
  if (t.includes('svg')) return 'svg'
  if (t.includes('png')) return 'png'
  if (t.includes('webp')) return 'webp'
  if (t.includes('heic') || t.includes('heif')) return 'heic'
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
  return fallback
}

async function copyUrl(bucket: any, sourceUrl: string, keyBase: string, fallbackExt: string) {
  const response = await fetch(sourceUrl, { redirect: 'follow' })
  if (!response.ok) throw new Error(`download ${response.status}`)
  const type = response.headers.get('content-type') || (fallbackExt === 'png' ? 'image/png' : 'image/jpeg')
  const ext = extForType(type, fallbackExt)
  const key = `${keyBase}.${ext}`
  const body = await response.arrayBuffer()
  await bucket.put(key, body, { httpMetadata: { contentType: type } })
  return { key, type, size: body.byteLength }
}

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || ''
  if (!isWorkersDevHost(host)) {
    return Response.json({ ok: false, error: 'This migration endpoint is available only on workers.dev staging.' }, { status: 404 })
  }
  if (req.nextUrl.searchParams.get('confirm') !== CONFIRM) {
    return Response.json({
      ok: false,
      stagingOnly: true,
      message: 'Add ?confirm=staging-media-migration to run one safe batch.',
    }, { status: 400, headers: { 'cache-control': 'no-store' } })
  }

  const { env } = getCloudflareContext()
  const db = (env as any).DB
  const bucket = (env as any).PHOTOS
  if (!db || !bucket) {
    return Response.json({ ok: false, error: 'D1 or R2 binding unavailable.' }, { status: 503 })
  }

  const result = { photos: { copied: 0, failed: 0 }, logos: { copied: 0, failed: 0 }, errors: [] as string[] }

  const photoRows = await db.prepare(`
    SELECT id, photo_url FROM photos
    WHERE photo_url LIKE 'http%'
    ORDER BY created_at ASC
    LIMIT ?
  `).bind(BATCH).all()

  for (const row of (photoRows.results || []) as any[]) {
    try {
      const copied = await copyUrl(bucket, String(row.photo_url), `legacy/${row.id}`, 'jpg')
      await db.prepare(`
        UPDATE photos
        SET photo_url=?, storage_provider='r2', storage_key=?, mime_type=?, file_size_bytes=?
        WHERE id=?
      `).bind(`/media/photos/${copied.key}`, copied.key, copied.type, copied.size, row.id).run()
      result.photos.copied++
    } catch (error) {
      result.photos.failed++
      result.errors.push(`photo:${row.id}:${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const logoCapacity = Math.max(0, BATCH - result.photos.copied)
  if (logoCapacity > 0) {
    const logoRows = await db.prepare(`
      SELECT id, logo_url FROM schools
      WHERE logo_url LIKE 'http%'
      ORDER BY school_name ASC
      LIMIT ?
    `).bind(logoCapacity).all()

    for (const row of (logoRows.results || []) as any[]) {
      try {
        const copied = await copyUrl(bucket, String(row.logo_url), `logos/${row.id}`, 'png')
        await db.prepare('UPDATE schools SET logo_url=? WHERE id=?')
          .bind(`/media/photos/${copied.key}`, row.id).run()
        result.logos.copied++
      } catch (error) {
        result.logos.failed++
        result.errors.push(`logo:${row.id}:${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  const remainingPhotos: any = await db.prepare("SELECT COUNT(*) AS count FROM photos WHERE photo_url LIKE 'http%'").first()
  const remainingLogos: any = await db.prepare("SELECT COUNT(*) AS count FROM schools WHERE logo_url LIKE 'http%'").first()
  const remaining = Number(remainingPhotos?.count || 0) + Number(remainingLogos?.count || 0)

  return Response.json({
    ok: result.errors.length === 0,
    stagingOnly: true,
    processed: result,
    remaining: {
      photos: Number(remainingPhotos?.count || 0),
      logos: Number(remainingLogos?.count || 0),
      total: remaining,
    },
    done: remaining === 0,
    repeatUrl: remaining > 0 ? `${req.nextUrl.origin}${req.nextUrl.pathname}?confirm=${CONFIRM}` : null,
  }, { headers: { 'cache-control': 'no-store' } })
}
