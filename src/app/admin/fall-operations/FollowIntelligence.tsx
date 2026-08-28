import { Bell, Users, UserRound, Activity } from 'lucide-react'

export default function FollowIntelligence({ rows }: { rows: any[] }) {
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
    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Anonymous-safe rollup of what fans are following and which alerts they want.</p>

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

    <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/[.06] p-3 text-xs text-sky-100/70">
      Delivery audit: final-score follows connect to the existing school score-alert subscription list. Schedule-change, live-update and photo preferences are being stored safely, but no outbound dispatcher for those channels exists yet, so the public follow UI does not promise immediate delivery for them.
    </div>
  </div>
}
