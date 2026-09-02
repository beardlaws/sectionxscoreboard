import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const EVENTS = new Set(['served', 'viewable', 'click'])
const PLACEMENTS = new Set(['homepage', 'scores', 'network', 'sport', 'school', 'playoff'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).host === req.nextUrl.host } catch { return false }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, error: 'Invalid origin.' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON.' }, { status: 400 }) }

  const event = String(body?.event || '')
  const sponsorId = String(body?.sponsor_id || '')
  const pagePath = String(body?.page_path || '')
  const placement = String(body?.placement_type || '')

  if (!EVENTS.has(event) || !UUID.test(sponsorId) || !PLACEMENTS.has(placement) || !pagePath.startsWith('/') || pagePath.length > 300) {
    return NextResponse.json({ ok: false, error: 'Invalid sponsor event.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: sponsor } = await db.from('sponsors').select('id,active').eq('id', sponsorId).maybeSingle()
  if (!sponsor?.id || sponsor.active !== true) return NextResponse.json({ ok: false, error: 'Sponsor unavailable.' }, { status: 404 })

  const table = event === 'click' ? 'sponsor_clicks' : event === 'viewable' ? 'sponsor_viewable_impressions' : 'sponsor_impressions'
  const { error } = await db.from(table).insert({ sponsor_id: sponsorId, page_path: pagePath, placement_type: placement })
  if (error) return NextResponse.json({ ok: false, error: 'Tracking write failed.' }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
