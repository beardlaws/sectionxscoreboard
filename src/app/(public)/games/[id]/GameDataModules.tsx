import Link from 'next/link'

type PeriodScore = {
  team_side: 'home' | 'away'
  period_number: number
  period_label: string | null
  score: number | null
}

type TeamStat = {
  team_side: 'home' | 'away'
  value_numeric: number | null
  value_text: string | null
  stat_definition: { label: string; unit: string | null; sort_order: number | null } | null
}

type AthleteStat = {
  athlete_id: string
  team_id: string | null
  value_numeric: number | null
  value_text: string | null
  athlete: { display_name: string; slug: string | null } | null
  stat_definition: { label: string; unit: string | null; sort_order: number | null } | null
}

const value = (numeric: number | null, text: string | null, unit?: string | null) =>
  text ?? (numeric == null ? '—' : `${numeric}${unit || ''}`)

export function PeriodScoreTable({ scores, awayName, homeName }: { scores: PeriodScore[]; awayName: string; homeName: string }) {
  if (!scores.length) return null
  const periods = Array.from(new Set(scores.map(s => s.period_number))).sort((a, b) => a - b)
  const labelFor = (n: number) => scores.find(s => s.period_number === n)?.period_label || String(n)
  const get = (side: 'home' | 'away', n: number) => scores.find(s => s.team_side === side && s.period_number === n)?.score ?? '—'
  return (
    <div className="card p-5 mb-4 overflow-x-auto">
      <div className="section-label mb-3">Scoring</div>
      <table className="w-full text-sm min-w-[420px]"><thead><tr style={{ color: 'var(--text-muted)' }}><th className="text-left py-2">Team</th>{periods.map(p => <th key={p} className="text-center px-2">{labelFor(p)}</th>)}</tr></thead><tbody><tr><td className="py-2 font-bold">{awayName}</td>{periods.map(p => <td key={p} className="text-center">{get('away', p)}</td>)}</tr><tr><td className="py-2 font-bold">{homeName}</td>{periods.map(p => <td key={p} className="text-center">{get('home', p)}</td>)}</tr></tbody></table>
    </div>
  )
}

export function TeamStatsTable({ stats, awayName, homeName }: { stats: TeamStat[]; awayName: string; homeName: string }) {
  if (!stats.length) return null
  const labels = Array.from(new Set(stats.map(s => s.stat_definition?.label).filter(Boolean))) as string[]
  return (
    <div className="card p-5 mb-4 overflow-x-auto"><div className="section-label mb-3">Team Stats</div><table className="w-full text-sm"><thead><tr style={{ color: 'var(--text-muted)' }}><th className="text-left py-2">Stat</th><th className="text-center">{awayName}</th><th className="text-center">{homeName}</th></tr></thead><tbody>{labels.map(label => { const a = stats.find(s => s.team_side === 'away' && s.stat_definition?.label === label); const h = stats.find(s => s.team_side === 'home' && s.stat_definition?.label === label); return <tr key={label} style={{ borderTop: '1px solid var(--border-subtle)' }}><td className="py-2">{label}</td><td className="text-center font-bold">{a ? value(a.value_numeric, a.value_text, a.stat_definition?.unit) : '—'}</td><td className="text-center font-bold">{h ? value(h.value_numeric, h.value_text, h.stat_definition?.unit) : '—'}</td></tr> })}</tbody></table></div>
  )
}

export function AthleteStatsTable({ stats }: { stats: AthleteStat[] }) {
  if (!stats.length) return null
  const athletes = Array.from(new Map(stats.filter(s => s.athlete).map(s => [s.athlete_id, s.athlete])).entries())
  const labels = Array.from(new Set(stats.map(s => s.stat_definition?.label).filter(Boolean))) as string[]
  return (
    <div className="card p-5 mb-4 overflow-x-auto"><div className="section-label mb-3">Player Stats</div><table className="w-full text-sm min-w-[520px]"><thead><tr style={{ color: 'var(--text-muted)' }}><th className="text-left py-2">Athlete</th>{labels.map(l => <th key={l} className="text-center px-2">{l}</th>)}</tr></thead><tbody>{athletes.map(([id, athlete]) => <tr key={id} style={{ borderTop: '1px solid var(--border-subtle)' }}><td className="py-2 font-bold">{athlete?.slug ? <Link href={`/athletes/${athlete.slug}`} className="hover:text-blue-400">{athlete.display_name}</Link> : athlete?.display_name}</td>{labels.map(label => { const s = stats.find(row => row.athlete_id === id && row.stat_definition?.label === label); return <td key={label} className="text-center">{s ? value(s.value_numeric, s.value_text, s.stat_definition?.unit) : '—'}</td> })}</tr>)}</tbody></table></div>
  )
}
