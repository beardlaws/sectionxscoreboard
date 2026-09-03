import { Bell, Users, UserRound, Activity, Check, X } from 'lucide-react'

type FollowRow = {
  id?: string
  email?: string | null
  team_id?: string | null
  athlete_id?: string | null
  alert_finals?: boolean
  alert_schedule_changes?: boolean
  alert_live?: boolean
  alert_photos?: boolean
  active?: boolean
  created_at?: string | null
  target_label?: string | null
}

function AlertFlag({ on, label }: { on?: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${on ? 'border-emerald-500/20 bg-emerald-500/[.07] text-emerald-200' : 'border-white/[.06] text-white/30'}`}>
    {on ? <Check size={11} /> : <X size={11} />}{label}
  </span>
}

export default function FollowIntelligence({ rows }: { rows: FollowRow[] }) {
  const active = rows.filter(r => r.active !== false)
  const team = active.filter(r => r.team_id).length
  const athlete = active.filter(r => r.athlete_id).length
  const finals = active.filter(r => r.alert_finals).length
  const schedule = active.filter(r => r.alert_schedule_changes).length
  const live = active.filter(r => r.alert_live).length
  const photos = active.filter(r => r.alert_photos).length
  const recent = active.filter(r => r.created_at && Date.now() - new Date(r.created_at).getTime() <= 7 * 86400000).length

  return <div className="card p-4">
    <div className="flex items-center gap-2">
      <Bell size={18} className="text-yellow-300" />
      <h2 className="font-semibold text-white">Fan Follow Intelligence</h2>
    </div>
    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Admin-only follower details plus the anonymous-safe rollup used for operations.</p>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
      {[
        [active.length, 'Active follows'],
        [team, 'Team follows'],
        [athlete, 'Athlete follows'],
        [recent, 'New last 7 days'],
      ].map(([n, label]) => <div key={label as string} className="rounded-lg bg-black/20 p-3 border border-white/[.06]">
        <b className="text-xl text-white">{n}</b>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      </div>)}
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
      <div className="rounded-lg border border-white/[.06] p-3"><div className="flex items-center gap-1 text-white/70"><Activity size={12} /> Final scores</div><b className="text-white text-base">{finals}</b></div>
      <div className="rounded-lg border border-white/[.06] p-3"><div className="flex items-center gap-1 text-white/70"><Users size={12} /> Schedule</div><b className="text-white text-base">{schedule}</b></div>
      <div className="rounded-lg border border-white/[.06] p-3"><div className="flex items-center gap-1 text-white/70"><UserRound size={12} /> Live</div><b className="text-white text-base">{live}</b></div>
      <div className="rounded-lg border border-white/[.06] p-3"><div className="flex items-center gap-1 text-white/70"><Bell size={12} /> Photos</div><b className="text-white text-base">{photos}</b></div>
    </div>

    {active.length > 0 && <details className="mt-4 rounded-lg border border-white/[.08] bg-black/10 overflow-hidden">
      <summary className="cursor-pointer select-none px-3 py-3 text-sm font-medium text-white hover:bg-white/[.03]">
        View active followers <span className="ml-1 text-white/40">({active.length})</span>
      </summary>
      <div className="border-t border-white/[.06] divide-y divide-white/[.06]">
        {active.map((row, index) => <div key={row.id || `${row.email}-${index}`} className="p-3">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-white break-all">{row.email || 'Email unavailable'}</div>
              <div className="text-xs mt-1 text-sky-200/80">{row.target_label || (row.team_id ? 'Team follow' : row.athlete_id ? 'Athlete follow' : 'Follow target unavailable')}</div>
              {row.created_at && <div className="text-[11px] mt-1 text-white/35">Followed {new Date(row.created_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} ET</div>}
            </div>
            <span className="self-start rounded-full border border-emerald-500/20 bg-emerald-500/[.07] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">Active</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <AlertFlag on={row.alert_finals} label="Finals" />
            <AlertFlag on={row.alert_schedule_changes} label="Schedule" />
            <AlertFlag on={row.alert_live} label="Live" />
            <AlertFlag on={row.alert_photos} label="Photos" />
          </div>
        </div>)}
      </div>
    </details>}

    <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/[.06] p-3 text-xs text-sky-100/70">
      Delivery audit: fan alert preferences feed the protected notification queue and outbound email dispatcher. Final-score, schedule-change, live-update and photo events are deduplicated, audited and delivered only to matching active follows; delivery health is shown below.
    </div>
  </div>
}
