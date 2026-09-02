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
  return verifyAdminSession(
    req.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.ADMIN_SESSION_TOKEN
  )
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: 'Invalid origin.' }, { status: 403 })
  if (await shouldIgnore(req)) return new NextResponse(null, { status: 204 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 }) }

  const event = String(body?.event || '')
  const sponsorId = String(body?.sponsor_id || '')
  const pagePath = String(body?.page_path || '')
  const placement = String(body?.placement_type || '')

  if (!EVENTS.has(event) || !UUID.test(sponsorId) || !PLACEMENTS.has(placement) || !pagePath.startsWith('/') || pagePath.length > 300) {
    return NextResponse.json({ ok: false, error: 'Invalid sponsor event.' }, { status: 400 })
  }

  // Sponsor IDs originate from the active sponsor payload already rendered to the
  // visitor. The tracking tables also enforce a foreign key to sponsors, so a
  // separate sponsor SELECT on every impression only doubles database work.
  const db = createAdminClient()
  const table = event === 'click' ? 'sponsor_clicks' : event === 'viewable' ? 'sponsor_viewable_impressions' : 'sponsor_impressions'
  const { error } = await db.from(table).insert({ sponsor_id: sponsorId, page_path: pagePath, placement_type: placement })
  if (error) return NextResponse.json({ ok: false, error: 'Tracking write failed.' }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
