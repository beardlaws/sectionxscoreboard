// src/app/admin/sponsors/analytics/page.tsx
'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { Download, RefreshCw, ShieldCheck } from 'lucide-react'

const PERIODS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: 9999 },
]

const fmtPct = (value: number | null | undefined) => value == null ? '—' : `${value.toFixed(2)}%`
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`

export default function SponsorAnalyticsPage() {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/sponsors/analytics?days=${period}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not load sponsor analytics.')
      setReport(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load sponsor analytics.')
    } finally { setLoading(false) }
  }

  function exportReport() {
    if (!report) return
    const rows = [
      ['Section X Scoreboard Sponsor Performance Report'],
      ['Generated At', report.generated_at],
      ['Period', period === 9999 ? 'All time' : `Last ${period} days`],
      ['Measurement Note', 'Served impressions are placements rendered on a page. Viewable impressions require at least 50% of the placement visible for at least one continuous second while the page is visible. Viewable tracking began 2026-09-02. Counts are events, not unique people.'],
      [],
      ['Business', 'Placement', 'Served Impressions', 'Viewable Impressions Since 2026-09-02', 'Clicks', 'Served CTR %', 'Monthly Rate', 'Last Served', 'Last Viewable', 'Last Click'],
      ...report.sponsors.map((s: any) => [
        s.business_name,
        s.placement_type,
        s.served_impressions,
        s.viewable_impressions,
        s.clicks,
        s.ctr == null ? 'N/A' : s.ctr.toFixed(4),
        s.price_monthly ? `$${s.price_monthly}` : 'N/A',
        s.last_impression_at || '',
        s.last_viewable_at || '',
        s.last_click_at || '',
      ]),
    ]
    const csv = rows.map((row: any[]) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `section-x-sponsor-report-${period}days-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totals = report?.totals || { served: 0, viewable: 0, clicks: 0, monthly_revenue: 0 }
  const stats = report?.sponsors || []

  return (
    <AdminLayout>
      <div className="p-4 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck size={21} className="text-emerald-400" />
              <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Sponsor Analytics</h1>
            </div>
            <p className="text-slate-400 text-sm mt-1">Exact first-party event counts from the production database — no estimates and no 1,000-row ceiling.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
            <button onClick={exportReport} disabled={!report} className="btn-secondary flex items-center gap-2 text-sm"><Download size={14} /> Export CSV</button>
          </div>
        </div>

        {report?.generated_at && <p className="text-xs text-slate-600 mb-4">Live report generated {new Date(report.generated_at).toLocaleString()}</p>}

        <div className="flex gap-2 mb-5 flex-wrap">
          {PERIODS.map(p => <button key={p.days} onClick={() => setPeriod(p.days)} className="text-xs font-black px-3 py-1.5 rounded-full transition-all" style={{ fontFamily: 'var(--font-display)', background: period === p.days ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.05)', color: period === p.days ? '#60a5fa' : '#4a5f7a', border: `1px solid ${period === p.days ? 'rgba(37,99,235,0.3)' : 'rgba(255,255,255,0.06)'}` }}>{p.label}</button>)}
        </div>

        {error && <div className="card p-4 mb-5 text-red-300 text-sm">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Served Impressions', value: totals.served.toLocaleString(), note: 'Rendered placements' },
            { label: 'Viewable Impressions', value: totals.viewable.toLocaleString(), note: 'Tracking began Sep 2' },
            { label: 'Total Clicks', value: totals.clicks.toLocaleString(), note: 'Sponsor visits' },
            { label: 'Monthly Revenue', value: `$${Number(totals.monthly_revenue).toFixed(0)}`, note: 'Active sponsor rates' },
          ].map(stat => <div key={stat.label} className="card p-4 text-center"><p className="text-2xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{stat.value}</p><p className="text-xs font-bold text-slate-400 mt-1">{stat.label}</p><p className="text-[10px] text-slate-600 mt-1">{stat.note}</p></div>)}
        </div>

        <div className="card p-4 mb-5 border border-emerald-500/20">
          <div className="text-xs font-black text-emerald-300 uppercase tracking-widest mb-2">Measurement Methodology</div>
          <p className="text-sm text-slate-300"><strong className="text-white">Served impression:</strong> the sponsor placement rendered on a page. <strong className="text-white">Viewable impression:</strong> at least 50% of the placement remained visible for at least one continuous second while the page was visible. <strong className="text-white">Click:</strong> a click/tap on the sponsor placement.</p>
          <p className="text-xs text-slate-500 mt-2">Viewable measurement begins September 2, 2026 and is not backfilled. These are event counts, not unique people. Historical served impressions remain labeled as served rather than being retroactively called viewable.</p>
        </div>

        {loading && !report ? <div className="text-center py-10 text-slate-500">Loading exact analytics…</div> : <div className="space-y-3">
          {stats.map((s: any) => {
            const legacyGap = s.served_impressions === 0 && s.clicks > 0
            return (
              <div key={s.sponsor_id} className={`card p-4 ${!s.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-4">
                  {s.logo_url && <img src={s.logo_url} alt={s.business_name} className="w-12 h-12 object-contain rounded-lg flex-shrink-0 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-3"><p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{s.business_name}</p>{!s.active && <span className="text-xs text-slate-600">Inactive</span>}<span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-500">{s.placement_type}</span>{s.price_monthly && <span className="text-xs font-bold text-green-400">${s.price_monthly}/mo</span>}</div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                      <Metric label="Served" value={s.served_impressions.toLocaleString()} />
                      <Metric label="Viewable since Sep 2" value={s.viewable_impressions.toLocaleString()} />
                      <Metric label="Clicks" value={s.clicks.toLocaleString()} />
                      <Metric label="Served CTR" value={legacyGap ? 'Legacy gap' : fmtPct(s.ctr)} />
                    </div>

                    {legacyGap && <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300 mb-3">Historical tracking gap: click records exist for this placement without matching served-impression records. The clicks are preserved, but no CTR is claimed.</div>}

                    {Array.isArray(s.top_pages) && s.top_pages.length > 0 && <div><p className="text-[10px] text-slate-600 mb-1 uppercase tracking-widest">Top pages by served impressions</p><div className="flex flex-wrap gap-1">{s.top_pages.map((item: any) => <span key={item.page} className="text-xs px-2 py-0.5 rounded bg-white/[0.04] text-slate-500">{item.page} ({Number(item.count).toLocaleString()})</span>)}</div></div>}

                    <div className="mt-3 p-3 rounded-lg text-xs text-slate-400" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      Sponsor-ready: Your Section X Scoreboard placement was served <strong className="text-white">{s.served_impressions.toLocaleString()}</strong> times and generated <strong className="text-white">{s.clicks.toLocaleString()}</strong> clicks {period === 9999 ? 'all time' : `in the last ${period} days`}. Viewable-impression measurement began September 2, 2026; <strong className="text-white">{s.viewable_impressions.toLocaleString()}</strong> qualifying viewable impressions have been recorded in the selected reporting window since that measurement began.
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>}
      </div>
    </AdminLayout>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg p-2.5 text-center bg-white/[0.025] border border-white/[0.06]"><p className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{value}</p><p className="text-[10px] text-slate-500 mt-0.5">{label}</p></div>
}
