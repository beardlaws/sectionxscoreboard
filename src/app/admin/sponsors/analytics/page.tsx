// src/app/admin/sponsors/analytics/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Download } from 'lucide-react'

const supabase = createClient()

const PERIODS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: 9999 },
]

export default function SponsorAnalyticsPage() {
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)
  const [sponsors, setSponsors] = useState<any[]>([])

  useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    const since = period === 9999
      ? '2000-01-01'
      : new Date(Date.now() - period * 86400000).toISOString()

    const [{ data: sp }, { data: imp }, { data: clk }] = await Promise.all([
      supabase.from('sponsors').select('id, business_name, placement_type, logo_url, active, price_monthly').order('business_name'),
      supabase.from('sponsor_impressions').select('sponsor_id, page_path, created_at').gte('created_at', since),
      supabase.from('sponsor_clicks').select('sponsor_id, page_path, created_at').gte('created_at', since),
    ])

    setSponsors(sp || [])

    // Build stats per sponsor
    const sponsorStats = (sp || []).map((s: any) => {
      const impressions = (imp || []).filter((i: any) => i.sponsor_id === s.id)
      const clicks = (clk || []).filter((c: any) => c.sponsor_id === s.id)
      const ctr = impressions.length > 0 ? ((clicks.length / impressions.length) * 100).toFixed(1) : '0.0'

      // Top pages by impressions
      const pageMap: Record<string, number> = {}
      impressions.forEach((i: any) => { pageMap[i.page_path] = (pageMap[i.page_path] || 0) + 1 })
      const topPages = Object.entries(pageMap).sort((a, b) => b[1] - a[1]).slice(0, 3)

      return {
        ...s,
        impressions: impressions.length,
        clicks: clicks.length,
        ctr,
        topPages,
      }
    }).sort((a: any, b: any) => b.impressions - a.impressions)

    setStats(sponsorStats)
    setLoading(false)
  }

  function exportReport() {
    const rows = [
      ['Business', 'Placement', 'Impressions', 'Clicks', 'CTR %', 'Monthly Rate'],
      ...stats.map(s => [
        s.business_name,
        s.placement_type,
        s.impressions,
        s.clicks,
        s.ctr + '%',
        s.price_monthly ? '$' + s.price_monthly : 'N/A',
      ])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sponsor-report-${period}days-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const totalImpressions = stats.reduce((s, a) => s + a.impressions, 0)
  const totalClicks = stats.reduce((s, a) => s + a.clicks, 0)
  const totalRevenue = stats.filter(s => s.active && s.price_monthly).reduce((s: number, a: any) => s + (a.price_monthly || 0), 0)

  return (
    <AdminLayout>
      <div className="p-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>
            📊 Sponsor Analytics
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={exportReport} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
        <p className="text-slate-400 text-sm mb-5">
          Share this data with sponsors to prove ROI and drive renewals.
        </p>

        {/* Period selector */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              className="text-xs font-black px-3 py-1.5 rounded-full transition-all"
              style={{
                fontFamily: 'var(--font-display)',
                background: period === p.days ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)',
                color: period === p.days ? '#60a5fa' : '#4a5f7a',
                border: `1px solid ${period === p.days ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Impressions', value: totalImpressions.toLocaleString(), icon: '👁', color: '#60a5fa' },
            { label: 'Total Clicks', value: totalClicks.toLocaleString(), icon: '👆', color: '#4ade80' },
            { label: 'Monthly Revenue', value: `$${totalRevenue.toFixed(0)}`, icon: '💰', color: '#fbbf24' },
          ].map(stat => (
            <div key={stat.label} className="card p-4 text-center">
              <p className="text-2xl mb-1">{stat.icon}</p>
              <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: stat.color }}>
                {stat.value}
              </p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Per-sponsor breakdown */}
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading...</div>
        ) : (
          <div className="space-y-3">
            {stats.length === 0 && (
              <div className="card p-8 text-center text-slate-500">
                No impression data yet. Data starts tracking once sponsors are displayed on the site.
              </div>
            )}
            {stats.map(s => (
              <div key={s.id} className={`card p-4 ${!s.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-4">
                  {s.logo_url && (
                    <img src={s.logo_url} alt={s.business_name}
                      className="w-12 h-12 object-contain rounded-lg flex-shrink-0 border border-white/10"
                      style={{ background: 'rgba(255,255,255,0.05)' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                        {s.business_name}
                      </p>
                      {!s.active && <span className="text-xs text-slate-600">Inactive</span>}
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#64748b' }}>
                        {s.placement_type}
                      </span>
                      {s.price_monthly && (
                        <span className="text-xs font-bold text-green-400">${s.price_monthly}/mo</span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="rounded-lg p-2 text-center"
                        style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
                        <p className="text-lg font-black text-blue-400" style={{ fontFamily: 'var(--font-display)' }}>
                          {s.impressions.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">Impressions</p>
                      </div>
                      <div className="rounded-lg p-2 text-center"
                        style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)' }}>
                        <p className="text-lg font-black text-green-400" style={{ fontFamily: 'var(--font-display)' }}>
                          {s.clicks.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500">Clicks</p>
                      </div>
                      <div className="rounded-lg p-2 text-center"
                        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
                        <p className="text-lg font-black text-yellow-400" style={{ fontFamily: 'var(--font-display)' }}>
                          {s.ctr}%
                        </p>
                        <p className="text-xs text-slate-500">Click Rate</p>
                      </div>
                    </div>

                    {/* Top pages */}
                    {s.topPages.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-600 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                          TOP PAGES
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {s.topPages.map(([page, count]: [string, number]) => (
                            <span key={page} className="text-xs px-2 py-0.5 rounded"
                              style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b' }}>
                              {page} ({count})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sponsor report snippet */}
                    <div className="mt-3 p-3 rounded-lg text-xs text-slate-400 italic"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      💬 "Your ad was seen <strong className="text-white">{s.impressions.toLocaleString()}</strong> times
                      and clicked <strong className="text-white">{s.clicks}</strong> times
                      in the last {period === 9999 ? 'all time' : `${period} days`} —
                      a {s.ctr}% click-through rate."
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
