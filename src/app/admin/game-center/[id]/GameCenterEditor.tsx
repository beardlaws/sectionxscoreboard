'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ExternalLink, CheckCircle2, BarChart3, Users, FileText, ListOrdered } from 'lucide-react'
import { adminDb } from '@/lib/adminDb'

type Props = {
  game: any
  periods: any[]
  teamStats: any[]
  athleteStats: any[]
  statDefinitions: any[]
  homeRoster: any[]
  awayRoster: any[]
}

type Tab = 'scoring' | 'team' | 'players' | 'recap'

function teamName(team: any, external: any, fallback: string) {
  return team?.school?.school_name || external?.name || fallback
}

function periodDefaults(sportName: string) {
  const name = sportName.toLowerCase()
  if (name.includes('soccer')) return [{ n: 1, label: '1H' }, { n: 2, label: '2H' }]
  if (name.includes('football') || name.includes('basketball') || name.includes('lacrosse')) return [1, 2, 3, 4].map(n => ({ n, label: `Q${n}` }))
  if (name.includes('hockey')) return [1, 2, 3].map(n => ({ n, label: `P${n}` }))
  if (name.includes('baseball') || name.includes('softball')) return [1, 2, 3, 4, 5, 6, 7].map(n => ({ n, label: String(n) }))
  if (name.includes('volleyball')) return [1, 2, 3, 4, 5].map(n => ({ n, label: `Set ${n}` }))
  return [1, 2, 3, 4].map(n => ({ n, label: String(n) }))
}

function StatInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="number"
      step="any"
      min="0"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input w-full text-center font-mono"
      placeholder="—"
    />
  )
}

export default function GameCenterEditor({ game, periods, teamStats, athleteStats, statDefinitions, homeRoster, awayRoster }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('scoring')
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [sourceType, setSourceType] = useState('admin')
  const [sourceName, setSourceName] = useState('Section X Scoreboard')
  const [verified, setVerified] = useState(true)

  const awayName = teamName(game.away_team, game.external_away, 'Away')
  const homeName = teamName(game.home_team, game.external_home, 'Home')
  const sportName = game.sport?.sport_name || 'Sport'

  const initialPeriods = useMemo(() => {
    const defaults = periodDefaults(sportName)
    const known = periods.length
      ? Array.from(new Set(periods.map((p: any) => Number(p.period_number)))).sort((a: number, b: number) => a - b)
      : defaults.map(p => p.n)
    return known.map((n: number) => {
      const existing = periods.find((p: any) => Number(p.period_number) === n && p.period_label)
      return { n, label: existing?.period_label || defaults.find(p => p.n === n)?.label || String(n) }
    })
  }, [periods, sportName])

  const [periodRows, setPeriodRows] = useState(() => initialPeriods)
  const [periodValues, setPeriodValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {}
    for (const row of periods) values[`${row.team_side}:${row.period_number}`] = row.score == null ? '' : String(row.score)
    return values
  })

  const teamDefs = statDefinitions.filter((d: any) => d.scope === 'team' || d.scope === 'both')
  const athleteDefs = statDefinitions.filter((d: any) => d.scope === 'athlete' || d.scope === 'both')

  const [teamValues, setTeamValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {}
    for (const row of teamStats) values[`${row.team_side}:${row.stat_definition_id}`] = row.value_numeric == null ? row.value_text || '' : String(row.value_numeric)
    return values
  })

  const [athleteValues, setAthleteValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {}
    for (const row of athleteStats) values[`${row.athlete_id}:${row.stat_definition_id}`] = row.value_numeric == null ? row.value_text || '' : String(row.value_numeric)
    return values
  })

  const [recap, setRecap] = useState(game.recap || '')
  const [recapAuthor, setRecapAuthor] = useState(game.recap_author || 'Section X Scoreboard')

  function flash(section: string) {
    setSaved(section)
    setTimeout(() => setSaved(current => current === section ? null : current), 2200)
  }

  async function run(section: string, fn: () => Promise<void>) {
    setSaving(section)
    setError('')
    try {
      await fn()
      flash(section)
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  async function savePeriods() {
    await run('scoring', async () => {
      for (const period of periodRows) {
        for (const side of ['away', 'home']) {
          const key = `${side}:${period.n}`
          const value = periodValues[key] ?? ''
          const existing = periods.find((p: any) => p.team_side === side && Number(p.period_number) === period.n)
          if (value === '') {
            if (existing) await adminDb.delete('game_period_scores', { game_id: game.id, team_side: side, period_number: period.n })
          } else {
            await adminDb.upsert('game_period_scores', {
              game_id: game.id,
              team_side: side,
              period_number: period.n,
              period_label: period.label,
              score: Number(value),
              updated_at: new Date().toISOString(),
            }, 'game_id,team_side,period_number')
          }
        }
      }
    })
  }

  async function saveTeamStats() {
    await run('team', async () => {
      for (const def of teamDefs) {
        for (const side of ['away', 'home']) {
          const key = `${side}:${def.id}`
          const value = teamValues[key] ?? ''
          const existing = teamStats.find((s: any) => s.team_side === side && s.stat_definition_id === def.id)
          if (value === '') {
            if (existing) await adminDb.delete('game_team_stats', { game_id: game.id, team_side: side, stat_definition_id: def.id })
          } else {
            await adminDb.upsert('game_team_stats', {
              game_id: game.id,
              team_side: side,
              stat_definition_id: def.id,
              value_numeric: Number(value),
              value_text: null,
              source_type: sourceType,
              source_name: sourceName || null,
              verified,
              updated_at: new Date().toISOString(),
            }, 'game_id,team_side,stat_definition_id')
          }
        }
      }
    })
  }

  async function saveAthleteStats() {
    await run('players', async () => {
      const rosters = [
        { rows: awayRoster, teamId: game.away_team_id },
        { rows: homeRoster, teamId: game.home_team_id },
      ]
      for (const roster of rosters) {
        for (const entry of roster.rows) {
          const athlete = Array.isArray(entry.athlete) ? entry.athlete[0] : entry.athlete
          const athleteId = athlete?.id || entry.athlete_id
          if (!athleteId) continue
          for (const def of athleteDefs) {
            const key = `${athleteId}:${def.id}`
            const value = athleteValues[key] ?? ''
            const existing = athleteStats.find((s: any) => s.athlete_id === athleteId && s.stat_definition_id === def.id)
            if (value === '') {
              if (existing) await adminDb.delete('game_athlete_stats', { game_id: game.id, athlete_id: athleteId, stat_definition_id: def.id })
            } else {
              await adminDb.upsert('game_athlete_stats', {
                game_id: game.id,
                athlete_id: athleteId,
                team_id: roster.teamId,
                stat_definition_id: def.id,
                value_numeric: Number(value),
                value_text: null,
                source_type: sourceType,
                source_name: sourceName || null,
                verified,
                updated_at: new Date().toISOString(),
              }, 'game_id,athlete_id,stat_definition_id')
            }
          }
        }
      }
    })
  }

  async function saveRecap() {
    await run('recap', async () => {
      await adminDb.update('games', { recap: recap || null, recap_author: recap ? recapAuthor || 'Section X Scoreboard' : null }, { id: game.id })
    })
  }

  function addPeriod() {
    const next = periodRows.length ? Math.max(...periodRows.map(p => p.n)) + 1 : 1
    setPeriodRows(rows => [...rows, { n: next, label: String(next) }])
  }

  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: 'scoring', label: 'Scoring', icon: ListOrdered, count: periods.length },
    { id: 'team', label: 'Team Stats', icon: BarChart3, count: teamStats.length },
    { id: 'players', label: 'Player Stats', icon: Users, count: athleteStats.length },
    { id: 'recap', label: 'Recap', icon: FileText, count: game.recap ? 1 : 0 },
  ]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-blue-400 font-black mb-1">Game Center Editor</div>
          <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{awayName} at {homeName}</h1>
          <p className="text-sm text-slate-400 mt-1">{sportName} · {game.game_date} · {game.status} · {game.away_score ?? '—'}-{game.home_score ?? '—'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/game-center/${game.id}`} target="_blank" className="btn-ghost flex items-center gap-2"><ExternalLink size={14} /> Public Game Center</Link>
          <Link href="/admin/scores/manage" className="btn-ghost">Back to Games</Link>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <div className="card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Stat Source</label>
            <select className="input w-full" value={sourceType} onChange={e => setSourceType(e.target.value)}>
              <option value="admin">Section X Admin</option>
              <option value="official">Official / School</option>
              <option value="coach">Coach / Team</option>
              <option value="scorebook">Scorebook / Stat Sheet</option>
              <option value="media">Media</option>
              <option value="community">Community Submission</option>
              <option value="historical">Historical Source</option>
            </select>
          </div>
          <div>
            <label className="label">Source Name</label>
            <input className="input w-full" value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="School, coach, newspaper, etc." />
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 mt-5 cursor-pointer">
            <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />
            <span><span className="block text-sm font-bold text-white">Verified stats</span><span className="block text-xs text-slate-500">Mark this data as reviewed</span></span>
          </label>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto mb-5 pb-1">
        {tabs.map(item => {
          const Icon = item.icon
          return <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap border transition-colors ${tab === item.id ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/[0.02] text-slate-400 border-white/10 hover:text-white'}`}><Icon size={15} />{item.label}{item.count ? <span className="text-xs opacity-70">{item.count}</span> : null}</button>
        })}
      </div>

      {tab === 'scoring' && (
        <section className="card overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Period Scoring</h2><p className="text-xs text-slate-500 mt-1">Adds detail only. It does not change the final score or standings.</p></div>
            <button onClick={addPeriod} className="btn-ghost text-sm">+ Period</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead><tr className="text-xs text-slate-500 border-b border-white/10"><th className="text-left p-3">Period</th><th className="p-3">{awayName}</th><th className="p-3">{homeName}</th></tr></thead>
              <tbody>{periodRows.map(period => <tr key={period.n} className="border-b border-white/5"><td className="p-3"><input value={period.label} onChange={e => setPeriodRows(rows => rows.map(r => r.n === period.n ? { ...r, label: e.target.value } : r))} className="input w-28" /></td><td className="p-3"><StatInput value={periodValues[`away:${period.n}`] || ''} onChange={value => setPeriodValues(v => ({ ...v, [`away:${period.n}`]: value }))} /></td><td className="p-3"><StatInput value={periodValues[`home:${period.n}`] || ''} onChange={value => setPeriodValues(v => ({ ...v, [`home:${period.n}`]: value }))} /></td></tr>)}</tbody>
            </table>
          </div>
          <div className="p-4 flex justify-end"><button onClick={savePeriods} disabled={saving === 'scoring'} className="btn-primary flex items-center gap-2"><Save size={14} />{saving === 'scoring' ? 'Saving...' : saved === 'scoring' ? 'Saved' : 'Save Scoring'}</button></div>
        </section>
      )}

      {tab === 'team' && (
        <section className="card overflow-hidden">
          <div className="p-4 border-b border-white/10"><h2 className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Team Stats</h2><p className="text-xs text-slate-500 mt-1">Sport-aware comparison stats for this game.</p></div>
          {teamDefs.length === 0 ? <div className="p-8 text-center text-slate-500">No team stat definitions are configured for {sportName} yet.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px]"><thead><tr className="text-xs text-slate-500 border-b border-white/10"><th className="text-left p-3">Stat</th><th className="p-3">{awayName}</th><th className="p-3">{homeName}</th></tr></thead><tbody>{teamDefs.map((def: any) => <tr key={def.id} className="border-b border-white/5"><td className="p-3 text-sm font-bold text-slate-200">{def.label}</td><td className="p-3"><StatInput value={teamValues[`away:${def.id}`] || ''} onChange={value => setTeamValues(v => ({ ...v, [`away:${def.id}`]: value }))} /></td><td className="p-3"><StatInput value={teamValues[`home:${def.id}`] || ''} onChange={value => setTeamValues(v => ({ ...v, [`home:${def.id}`]: value }))} /></td></tr>)}</tbody></table></div>}
          <div className="p-4 flex justify-end"><button onClick={saveTeamStats} disabled={saving === 'team' || teamDefs.length === 0} className="btn-primary flex items-center gap-2"><Save size={14} />{saving === 'team' ? 'Saving...' : saved === 'team' ? 'Saved' : 'Save Team Stats'}</button></div>
        </section>
      )}

      {tab === 'players' && (
        <section className="space-y-4">
          {[{ name: awayName, roster: awayRoster }, { name: homeName, roster: homeRoster }].map(side => <div key={side.name} className="card overflow-hidden"><div className="p-4 border-b border-white/10"><h2 className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{side.name} Player Stats</h2><p className="text-xs text-slate-500 mt-1">Blank cells stay unpublished.</p></div>{side.roster.length === 0 ? <div className="p-8 text-center text-slate-500">No roster loaded for this team.</div> : athleteDefs.length === 0 ? <div className="p-8 text-center text-slate-500">No player stat definitions configured for {sportName}.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[680px]"><thead><tr className="text-xs text-slate-500 border-b border-white/10"><th className="text-left p-3">Player</th>{athleteDefs.map((def: any) => <th key={def.id} className="p-3 text-center">{def.label}</th>)}</tr></thead><tbody>{side.roster.map((entry: any) => { const athlete = Array.isArray(entry.athlete) ? entry.athlete[0] : entry.athlete; if (!athlete) return null; return <tr key={entry.athlete_id} className="border-b border-white/5"><td className="p-3"><div className="font-bold text-slate-200">{entry.jersey_number ? `#${entry.jersey_number} ` : ''}{athlete.display_name}</div>{entry.position && <div className="text-xs text-slate-600">{entry.position}</div>}</td>{athleteDefs.map((def: any) => <td key={def.id} className="p-2 min-w-[90px]"><StatInput value={athleteValues[`${entry.athlete_id}:${def.id}`] || ''} onChange={value => setAthleteValues(v => ({ ...v, [`${entry.athlete_id}:${def.id}`]: value }))} /></td>)}</tr>})}</tbody></table></div>}</div>)}
          <div className="flex justify-end"><button onClick={saveAthleteStats} disabled={saving === 'players' || athleteDefs.length === 0} className="btn-primary flex items-center gap-2"><Save size={14} />{saving === 'players' ? 'Saving...' : saved === 'players' ? 'Saved' : 'Save Player Stats'}</button></div>
        </section>
      )}

      {tab === 'recap' && (
        <section className="card p-5 max-w-4xl">
          <h2 className="text-lg font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Game Recap</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">Shows directly inside Game Center when published.</p>
          <label className="label">Recap</label>
          <textarea className="input w-full resize-y min-h-[220px]" value={recap} onChange={e => setRecap(e.target.value)} placeholder="Who stood out? What changed the game? How did it finish?" />
          <div className="text-xs text-slate-600 mt-1 mb-4">{recap.length} characters</div>
          <label className="label">Author / Credit</label>
          <input className="input w-full" value={recapAuthor} onChange={e => setRecapAuthor(e.target.value)} />
          <div className="mt-4 flex justify-end"><button onClick={saveRecap} disabled={saving === 'recap'} className="btn-primary flex items-center gap-2"><Save size={14} />{saving === 'recap' ? 'Saving...' : saved === 'recap' ? 'Saved' : 'Save Recap'}</button></div>
        </section>
      )}

      <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-xs text-emerald-200/80 flex gap-2"><CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" /><span>Game Center enrichment is separate from the final score. Scoring breakdowns, stats, and recaps can be added or removed without changing standings.</span></div>
    </div>
  )
}
