import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
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
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return true
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

  // Accept both the new batched payload and the previous single-event payload so
  // clients already open during a deployment continue to measure correctly.
  const rawEvents = Array.isArray(body?.events) ? body.events.slice(0, 20) : [body]
  const events = rawEvents.map(validEvent)
  if (!events.length || events.some(event => !event)) {
    return NextResponse.json({ ok: false, error: 'Invalid sponsor event.' }, { status: 400 })
  }

  const db = createAdminClient()
  const groups = {
    served: events.filter((event: any) => event.event === 'served').map(({ event, ...row }: any) => row),
    viewable: events.filter((event: any) => event.event === 'viewable').map(({ event, ...row }: any) => row),
    click: events.filter((event: any) => event.event === 'click').map(({ event, ...row }: any) => row),
  }

  const writes: PromiseLike<any>[] = []
  if (groups.served.length) writes.push(db.from('sponsor_impressions').insert(groups.served))
  if (groups.viewable.length) writes.push(db.from('sponsor_viewable_impressions').insert(groups.viewable))
  if (groups.click.length) writes.push(db.from('sponsor_clicks').insert(groups.click))

  const results = await Promise.all(writes)
  if (results.some(result => result.error)) {
    return NextResponse.json({ ok: false, error: 'Tracking write failed.' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
