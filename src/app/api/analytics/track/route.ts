import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const BOT_RE = /bot|crawler|spider|crawling|headless|lighthouse|pagespeed|google-inspectiontool|facebookexternalhit|slurp|bingpreview|cloudflare|uptime|monitor/i

function clean(value: unknown, max = 1000) {
  return typeof value === 'string' ? value.slice(0, max) : null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const path = clean(body?.path, 1500)
    const visitorId = clean(body?.visitorId, 80)
    const sessionId = clean(body?.sessionId, 80)
    if (!path || !visitorId || !sessionId || path.startsWith('/admin') || path.startsWith('/api')) {
      return new NextResponse(null, { status: 204 })
    }

    const ua = req.headers.get('user-agent') || ''
    const referrer = clean(body?.referrer, 2000)
    let referrerHost: string | null = null
    if (referrer) {
      try {
        const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
        if (host && host !== 'sectionxscoreboard.com') referrerHost = host
      } catch {}
    }

    const supabase = createAdminClient()
    await supabase.from('site_traffic_events').insert({
      event_name: 'page_view',
      path,
      page_title: clean(body?.title, 500),
      referrer,
      referrer_host: referrerHost,
      session_id: sessionId,
      visitor_id: visitorId,
      user_agent: clean(ua, 1000),
      is_admin: false,
      is_bot: BOT_RE.test(ua),
    })
  } catch {
    // Analytics must never interfere with the public site.
  }
  return new NextResponse(null, { status: 204 })
}
