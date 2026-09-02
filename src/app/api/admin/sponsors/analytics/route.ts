import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rawDays = Number(req.nextUrl.searchParams.get('days') || 30)
  const days = rawDays === 9999 ? 9999 : [7, 30, 90].includes(rawDays) ? rawDays : 30
  const since = days === 9999 ? new Date('2000-01-01T00:00:00.000Z') : new Date(Date.now() - days * 86400000)

  const db = createAdminClient()
  const { data, error } = await db.rpc('admin_sponsor_analytics', { p_since: since.toISOString() })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const rows = (data || []).map((row: any) => {
    const served = Number(row.served_impressions || 0)
    const viewable = Number(row.viewable_impressions || 0)
    const clicks = Number(row.clicks || 0)
    return {
      ...row,
      served_impressions: served,
      viewable_impressions: viewable,
      clicks,
      ctr: served > 0 ? (clicks / served) * 100 : null,
      viewability_rate: served > 0 ? (viewable / served) * 100 : null,
    }
  })

  const totals = rows.reduce((acc: any, row: any) => {
    acc.served += row.served_impressions
    acc.viewable += row.viewable_impressions
    acc.clicks += row.clicks
    if (row.active && row.price_monthly) acc.monthly_revenue += Number(row.price_monthly)
    return acc
  }, { served: 0, viewable: 0, clicks: 0, monthly_revenue: 0 })

  return NextResponse.json({
    ok: true,
    period_days: days,
    since: since.toISOString(),
    generated_at: new Date().toISOString(),
    measurement: {
      served_definition: 'Sponsor placement rendered on a page.',
      viewable_definition: 'At least 50% of the placement was visible for at least one continuous second while the page was visible.',
      viewable_tracking_started: '2026-09-02',
      counts_are_unique_people: false,
    },
    totals,
    sponsors: rows,
  })
}
