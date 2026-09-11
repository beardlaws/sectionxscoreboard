import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getDb(){
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

export async function GET(req: NextRequest) {
  try {
    const rawDays = Number(req.nextUrl.searchParams.get('days') || 30)
    const days = rawDays === 9999 ? 9999 : [7, 30, 90].includes(rawDays) ? rawDays : 30
    const since = days === 9999 ? '2000-01-01T00:00:00.000Z' : new Date(Date.now() - days * 86400000).toISOString()
    const db = getDb()

    const result = await db.prepare(`
      SELECT s.id,s.business_name,s.placement_type,s.school_id,s.sport_id,s.active,s.price_monthly,s.start_date,s.end_date,
        (SELECT COUNT(*) FROM sponsor_impressions i WHERE i.sponsor_id=s.id AND i.created_at>=?) AS served_impressions,
        (SELECT COUNT(*) FROM sponsor_viewable_impressions v WHERE v.sponsor_id=s.id AND v.created_at>=?) AS viewable_impressions,
        (SELECT COUNT(*) FROM sponsor_clicks c WHERE c.sponsor_id=s.id AND c.created_at>=?) AS clicks
      FROM sponsors s
      ORDER BY s.active DESC,s.business_name ASC
    `).bind(since,since,since).all()

    const rows = (result.results || []).map((row: any) => {
      const served = Number(row.served_impressions || 0)
      const viewable = Number(row.viewable_impressions || 0)
      const clicks = Number(row.clicks || 0)
      return {
        ...row,
        active:Boolean(row.active),
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
      since,
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
  } catch (error:any) {
    return NextResponse.json({ ok:false, error:error?.message || 'Could not load sponsor analytics.' }, { status:500 })
  }
}
