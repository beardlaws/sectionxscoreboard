'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react'

function easternDate(offset = 0) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const get = (type: string) => parts.find(p => p.type === type)?.value || ''
  const noon = new Date(Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')) + offset, 12))
  return noon.toISOString().slice(0, 10)
}

const EXEMPT_REASONS = [
  ['no-team-score-published', 'No team score published'],
  ['meet-result-unavailable', 'Meet result unavailable'],
  ['event-wrapper', 'Tournament / event wrapper'],
  ['abandoned-no-official-result', 'No official result'],
  ['other', 'Other'],
] as const

function reasonLabel(value: string | null | undefined) {
  return EXEMPT_REASONS.find(([id]) => id === value)?.[1] || value || 'Result exempt'
}

export default function DailyResults() {
  const [date, setDate] = useState(() => easternDate())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [updatingGame, setUpdatingGame] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/admin/score-intelligence/day?date=${date}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || 'Results check failed')
      setData(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function sweepNorthCountrySports() {
    if (!confirm(`Check North Country Sports for ${date} and fill only exact existing games that still have blank scores?`)) return

    setSweeping(true)
    setError(null)
    setMessage(null)

    try {
      const r = await fetch('/api/admin/score-intelligence/overnight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: 'RUN_OVERNIGHT_SCORE_SWEEP',
          date,
        }),
      })
      const j = await r.json()
      if (!r.ok && r.status !== 207) throw new Error(j.error || 'Overnight sweep failed')

      setMessage(
        j.published
          ? `North Country Sports: parsed ${j.parsed}; applied ${j.applied?.updated || 0}; already known/protected ${Math.max((j.parsed || 0) - (j.applied?.updated || 0), 0)}. Final coverage ${j.coverage?.percent ?? '—'}%; accounted for ${j.coverage?.accountedFor ?? '—'}%.`
          : j.reason || 'North Country Sports has not published this date yet.'
      )

      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSweeping(false)
    }
  }

  async function setExempt(gameId: string, exempt: boolean) {
    let reason = ''
    if (exempt) {
      const choice = window.prompt(
        'Reason? Enter one of:\n1 = No team score published\n2 = Meet result unavailable\n3 = Tournament/event wrapper\n4 = No official result\n5 = Other',
        '2'
      )
      if (choice == null) return
      const map: Record<string, string> = {
        '1': 'no-team-score-published',
        '2': 'meet-result-unavailable',
        '3': 'event-wrapper',
        '4': 'abandoned-no-official-result',
        '5': 'other',
      }
      reason = map[choice.trim()] || choice.trim()
    }

    setUpdatingGame(gameId)
    setError(null)
    setMessage(null)

    try {
      const r = await fetch('/api/admin/score-intelligence/exempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId, exempt, reason }),
      })
      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || 'Could not update result exemption.')
      setMessage(exempt ? 'Result marked exempt from missing-score coverage.' : 'Result exemption removed.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUpdatingGame(null)
    }
  }

  useEffect(() => { void load() }, [date])

  const coverage = data?.summary?.coverage ?? 0
  const accountedFor = data?.summary?.accountedFor ?? 0

  return <div className="p-4 max-w-6xl space-y-5">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Today’s Results</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Game-night and overnight view of what is final, what is still missing, and what has been explicitly accounted for.
        </p>
      </div>
      <div className="flex gap-2">
        <Link href="/admin/score-intelligence" className="admin-action-btn justify-center">Score Intelligence</Link>
        <Link href="/admin/fall-operations" className="admin-action-btn justify-center">Fall Operations</Link>
      </div>
    </div>

    <div className="card p-4 flex flex-col md:flex-row gap-3 md:items-end">
      <label className="text-sm">
        <span style={{ color: 'var(--text-muted)' }}>Game date</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="block mt-1 rounded border border-white/10 bg-black/30 px-3 py-2 text-white" />
      </label>
      <button onClick={load} disabled={loading} className="admin-action-btn justify-center">
        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Checking…' : 'Refresh'}
      </button>
      <button onClick={sweepNorthCountrySports} disabled={sweeping} className="admin-action-btn justify-center">
        <ShieldCheck size={18} className={sweeping ? 'animate-pulse' : ''} />
        {sweeping ? 'Checking NCS…' : 'Check North Country Sports'}
      </button>
      <button onClick={() => setDate(easternDate(-1))} className="admin-action-btn justify-center">Yesterday</button>
    </div>

    {error && <div className="rounded-lg p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
      <AlertTriangle size={16} className="inline mr-2" />{error}
    </div>}

    {message && <div className="rounded-lg p-3 border border-blue-500/30 bg-blue-500/10 text-blue-200 text-sm">
      <ShieldCheck size={16} className="inline mr-2" />{message}
    </div>}

    {data && <>
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
        {[
          ['Official games', data.summary.officialGames],
          ['Final', data.summary.final],
          ['Reported', data.summary.reported],
          ['Exempt', data.summary.exempt],
          ['Missing', data.summary.missing],
          ['Final coverage', `${coverage}%`],
          ['Accounted for', `${accountedFor}%`],
        ].map(([l, v]: any) => <div key={l} className="card p-4">
          <div className={`text-xl font-bold ${l === 'Accounted for' && accountedFor === 100 ? 'text-emerald-300' : 'text-white'}`}>{v}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</div>
        </div>)}
      </div>

      <div className={`rounded-xl border p-4 ${accountedFor === 100 ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>
        <div className={`font-semibold ${accountedFor === 100 ? 'text-emerald-200' : 'text-amber-200'}`}>
          {accountedFor === 100
            ? `All ${data.summary.officialGames} official contests are accounted for. Final coverage: ${coverage}%.`
            : `${data.summary.missing} official result${data.summary.missing === 1 ? '' : 's'} still missing · ${accountedFor}% accounted for.`}
        </div>
        <div className="text-xs mt-1 text-white/50">
          Exempt results are accounted for but do not inflate final-score coverage. Scrimmages and canceled/postponed games are excluded entirely.
        </div>
      </div>

      <div className="card p-4">
        <div className="space-y-2">
          {data.rows.length === 0
            ? <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No games scheduled for this date.</div>
            : data.rows.map((g: any) => <div key={g.id} className="rounded border border-white/10 bg-black/20 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <b className="text-white">{g.away} {g.awayScore ?? '—'} at {g.home} {g.homeScore ?? '—'}</b>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {g.sport}{g.gender ? ` · ${g.gender}` : ''} · {g.time || 'TBA'} · {g.source || 'unknown source'}
                </div>
                {g.resultState === 'exempt' && <div className="text-xs mt-1 text-violet-300">{reasonLabel(g.resultExemptReason)}</div>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className={`text-xs font-semibold ${
                  g.resultState === 'final'
                    ? 'text-emerald-300'
                    : g.resultState === 'score-reported'
                      ? 'text-sky-300'
                      : g.resultState === 'exempt'
                        ? 'text-violet-300'
                        : g.resultState === 'scrimmage' || g.resultState === 'excluded'
                          ? 'text-slate-500'
                          : 'text-amber-300'
                }`}>
                  {g.resultState === 'final'
                    ? <><CheckCircle2 size={14} className="inline mr-1" />Final</>
                    : g.resultState === 'score-reported'
                      ? 'Score Reported'
                      : g.resultState === 'exempt'
                        ? 'Result Exempt'
                        : g.resultState === 'scrimmage'
                          ? 'Scrimmage'
                          : g.resultState === 'excluded'
                            ? g.status || 'Excluded'
                            : 'Missing Result'}
                </div>

                {g.resultState === 'missing-result' && <button
                  onClick={() => setExempt(g.id, true)}
                  disabled={updatingGame === g.id}
                  className="rounded border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-200 disabled:opacity-40"
                >
                  Mark Exempt
                </button>}

                {g.resultState === 'exempt' && <button
                  onClick={() => setExempt(g.id, false)}
                  disabled={updatingGame === g.id}
                  className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-300 disabled:opacity-40"
                >
                  Remove Exemption
                </button>}
              </div>
            </div>)}
        </div>
      </div>
    </>}
  </div>
}
