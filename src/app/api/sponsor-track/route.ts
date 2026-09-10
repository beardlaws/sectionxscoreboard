import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const EVENTS = new Set(['served', 'viewable', 'click'])
const PLACEMENTS = new Set(['homepage', 'scores', 'network', 'sport', 'school', 'playoff'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const BOT_UA = /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|googleother|headlesschrome|lighthouse|pagespeed|uptime|monitoring)/i

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).host === req.nextUrl.host } catch { return false }
}

async function shouldIgnore(req: NextRequest) {
  if (BOT_UA.test(req.headers.get('user-agent') || '')) return true
  return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value, process.env.ADMIN_SESSION_TOKEN)
}

function validEvent(body: any) {
  const event = String(body?.event || '')
  const sponsorId = String(body?.sponsor_id || '')
  const pagePath = String(body?.page_path || '')
  const placement = String(body?.placement_type || '')
  if (!EVENTS.has(event) || !UUID.test(sponsorId) || !PLACEMENTS.has(placement) || !pagePath.startsWith('/') || pagePath.length > 300) return null
  return { event, sponsor_id: sponsorId, page_path: pagePath, placement_type: placement }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: 'Invalid origin.' }, { status: 403 })
  if (await shouldIgnore(req)) return new NextResponse(null, { status: 204 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 }) }

  const rawEvents = Array.isArray(body?.events) ? body.events.slice(0, 20) : [body]
  const events = rawEvents.map(validEvent)
  if (!events.length || events.some(event => !event)) {
    return NextResponse.json({ ok: false, error: 'Invalid sponsor event.' }, { status: 400 })
  }

  try {
    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

    const tableFor = (event: string) => event === 'click' ? 'sponsor_clicks' : event === 'viewable' ? 'sponsor_viewable_impressions' : 'sponsor_impressions'
    const statements = events.map((event: any) => db.prepare(
      `INSERT INTO ${tableFor(event.event)} (id,sponsor_id,page_path,placement_type,created_at) VALUES (?,?,?,?,datetime('now'))`
    ).bind(crypto.randomUUID(), event.sponsor_id, event.page_path, event.placement_type))
    if (statements.length) await db.batch(statements)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('[sponsor-track]', error)
    return NextResponse.json({ ok: false, error: 'Tracking write failed.' }, { status: 500 })
  }
}
