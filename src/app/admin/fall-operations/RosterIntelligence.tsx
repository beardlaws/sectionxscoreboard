import { ShieldCheck, Clock3, AlertTriangle, Database } from 'lucide-react'

export default function RosterIntelligence({ rows }: { rows: any[] }) {
  const counts = rows.reduce((acc: Record<string, number>, row: any) => {
    const key = row.status || 'not-scanned'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const published = rows.filter(r => r.publicly_visible).length
  const prior = counts['prior-season-roster'] || 0
  const awaiting = counts['awaiting-current-roster'] || 0
  const review = counts['review-needed'] || 0
  const notScanned = rows.filter(r => !r.status).length
  const stored = rows.reduce((n, r) => n + Number(r.active_arbiter_roster_entries || 0), 0)
  const scanned = rows.filter(r => Boolean(r.status)).length
  const held = Math.max(0, scanned - published)

  return <div className="card p-4">
    <div className="flex items-center gap-2">
      <ShieldCheck size={18} className="text-emerald-300" />
      <h2 className="font-semibold text-white">Roster Publication Intelligence</h2>
    </div>
    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Current-season Arbiter roster data: what is stored, what has passed freshness verification, and what fans are actually allowed to see.</p>

    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
      {[
        [published, 'Verified & public'],
        [prior, 'Prior season held'],
        [awaiting, 'Awaiting roster'],
        [review, 'Needs review'],
        [notScanned, 'Not scanned'],
        [stored, 'Stored Arbiter players'],
      ].map(([n, label]) => <div key={label as string} className="rounded-lg bg-black/20 p-3 border border-white/[.06]">
        <b className="text-xl text-white">{n}</b>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      </div>)}
    </div>

    <div className="mt-4 flex flex-wrap gap-2 text-xs">
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/[.06] px-2.5 py-1 text-emerald-300"><ShieldCheck size={12} /> {published} verified & public</span>
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/[.06] px-2.5 py-1 text-amber-300"><Clock3 size={12} /> {held} scanned & held</span>
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/[.06] px-2.5 py-1 text-sky-300"><Database size={12} /> {stored} stored Arbiter player rows</span>
      {review > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/[.06] px-2.5 py-1 text-red-300"><AlertTriangle size={12} /> {review} need review</span>}
    </div>

    {rows.length === 0 && <div className="mt-4 rounded border border-amber-500/20 bg-amber-500/[.05] p-3 text-xs text-amber-200">No active-season publication rows were returned. This is an admin data-health signal, not permission to publish unverified roster data.</div>}
  </div>
}
