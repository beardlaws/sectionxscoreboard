'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  RefreshCw,
  ShieldCheck,
  Upload,
} from 'lucide-react'

type Sport = {
  id: string
  sport_name: string
  gender?: string | null
  slug?: string | null
}

type Props = {
  sports: Sport[]
}

const SOURCES = [
  { id: 'northcountrysports', label: 'North Country Sports' },
  { id: 'highschoolsportstats', label: 'HighSchoolSportStats' },
  { id: 'manual-batch', label: 'Manual / Other' },
  { id: 'other', label: 'Other Trusted Source' },
]

const EXAMPLE = `Away School,3,Home School,1`

const readable = (v: string) =>
  String(v || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, m => m.toUpperCase())

export default function ScoreIntelligence({ sports }: Props) {
  const [source, setSource] = useState('northcountrysports')
  const [defaultDate, setDefaultDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [defaultSport, setDefaultSport] = useState('')
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [exampleLoaded, setExampleLoaded] = useState(false)

  async function runPreview() {
    if (!defaultDate || !defaultSport || !text.trim()) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const r = await fetch('/api/admin/score-intelligence/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          text,
          defaultDate,
          defaultSport,
        }),
      })

      const j = await r.json()
      if (!r.ok || !j.ok) throw new Error(j.error || 'Preview failed')
      setPreview(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function applySafe() {
    const rows = preview?.rows?.filter((r: any) => r.safeToApply) || []
    if (!rows.length) return

    if (
      !confirm(
        `Apply ${rows.length} score${rows.length === 1 ? '' : 's'} to existing blank games? No games will be created and any score entered since preview will remain protected.`
      )
    ) {
      return
    }

    setApplying(true)
    setError(null)
    setMessage(null)

    try {
      const r = await fetch('/api/admin/score-intelligence/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: 'APPLY_SCORE_INTELLIGENCE_RESULTS',
          source,
          rows,
        }),
      })

      const j = await r.json()
      if (!r.ok && r.status !== 207) throw new Error(j.error || 'Apply failed')

      setMessage(
        `Applied ${j.updated} existing-game score${j.updated === 1 ? '' : 's'}; ${j.skipped} protected/skipped; ${j.failed} failed; ${j.gamesCreated ?? 0} games created.`
      )

      await runPreview()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApplying(false)
    }
  }

  const rows = preview?.rows || []
  const grouped = useMemo(
    () => ({
      safe: rows.filter((r: any) => r.safeToApply),
      verified: rows.filter((r: any) => r.bucket === 'verified'),
      conflicts: rows.filter((r: any) => r.bucket === 'conflict'),
      protected: rows.filter((r: any) => r.bucket === 'protected'),
      unmatched: rows.filter((r: any) => ['unmatched', 'ambiguous'].includes(r.bucket)),
    }),
    [rows]
  )

  return (
    <div className="p-4 max-w-6xl space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={24} style={{ color: 'var(--accent-bright)' }} />
            <h1
              className="text-2xl font-bold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Score Intake
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Pick the day and sport, paste final scores, and attach them to games already created by the schedule system.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/import" className="admin-action-btn justify-center">
            ← Import Center
          </Link>
          <Link href="/admin/game-center" className="admin-action-btn justify-center">
            Game Center
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="text-emerald-300 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-emerald-200">Existing-game-only safety is ON</div>
            <div className="text-sm mt-1 text-emerald-100/80">
              This tool cannot create a game. It only fills a completely blank score on one exact existing matchup. Existing scores, scrimmages, postponed/canceled games, and ambiguous matches are protected.
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-3 border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <AlertTriangle size={16} className="inline mr-2" />
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg p-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
          <CheckCircle2 size={16} className="inline mr-2" />
          {message}
        </div>
      )}

      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm">
            <span style={{ color: 'var(--text-muted)' }}>Date</span>
            <input
              type="date"
              value={defaultDate}
              onChange={e => {
                setDefaultDate(e.target.value)
                setPreview(null)
              }}
              className="w-full mt-1 rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
          </label>

          <label className="text-sm">
            <span style={{ color: 'var(--text-muted)' }}>Sport</span>
            <select
              value={defaultSport}
              onChange={e => {
                setDefaultSport(e.target.value)
                setPreview(null)
              }}
              className="w-full mt-1 rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
            >
              <option value="">Select sport...</option>
              {sports.map(s => (
                <option key={s.id} value={s.sport_name}>
                  {s.sport_name}{s.gender ? ` (${s.gender})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span style={{ color: 'var(--text-muted)' }}>Score source</span>
            <select
              value={source}
              onChange={e => {
                setSource(e.target.value)
                setPreview(null)
              }}
              className="w-full mt-1 rounded border border-white/10 bg-black/30 px-3 py-2 text-white"
            >
              {SOURCES.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div>
              <div className="text-sm font-semibold text-white">Paste final scores</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Fast format: Away Team, Away Score, Home Team, Home Score. You can also paste lines like “Away Team 3, Home Team 1”.
              </div>
            </div>
            <button
              onClick={() => {
                setText(EXAMPLE)
                setPreview(null)
                setExampleLoaded(true)
              }}
              className="admin-action-btn justify-center"
            >
              <ClipboardPaste size={18} /> Format Example
            </button>
          </div>

          {exampleLoaded && (
            <div className="rounded-lg p-3 border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm mb-2">
              <AlertTriangle size={16} className="inline mr-2" />
              <b>FORMAT EXAMPLE ONLY.</b> Replace the placeholder schools and score before previewing.
            </div>
          )}

          <textarea
            value={text}
            onChange={e => {
              setText(e.target.value)
              setPreview(null)
              if (e.target.value !== EXAMPLE) setExampleLoaded(false)
            }}
            rows={10}
            className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white font-mono"
            placeholder={'Harrisville,58,Heuvelton,51\nCanton,64,Potsdam,59'}
          />
        </div>

        <button
          onClick={runPreview}
          disabled={loading || !text.trim() || !defaultDate || !defaultSport || exampleLoaded}
          className="admin-action-btn justify-center w-full disabled:opacity-40"
        >
          {loading ? <RefreshCw size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
          {loading
            ? 'Matching existing games…'
            : exampleLoaded
              ? 'Replace Example Before Preview'
              : !defaultSport
                ? 'Choose a Sport'
                : 'Preview & Match Existing Games'}
        </button>
      </div>

      {preview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            {[
              ['Received', preview.summary.received],
              ['Matched', preview.summary.matched],
              ['Ready', preview.summary.safe],
              ['Already Same', preview.summary.verified],
              ['Conflicts', preview.summary.conflicts],
              ['Needs Review', preview.summary.unmatched + preview.summary.ambiguous + (preview.summary.protected || 0)],
              ['Games Created', preview.summary.gamesCreated || 0],
            ].map(([label, value]: any) => (
              <div key={label} className="card p-4">
                <div className="text-xl font-bold text-white">{value}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {preview.parseErrors?.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-amber-300 mb-2">Rows that could not be parsed</h2>
              {preview.parseErrors.map((x: string, i: number) => (
                <div key={i} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {x}
                </div>
              ))}
            </div>
          )}

          <div className="card p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-white">Review before publishing</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Only “Safe Fill” rows can be written. Everything else stays untouched.
                </p>
              </div>
              <button
                onClick={applySafe}
                disabled={!grouped.safe.length || applying}
                className="admin-action-btn justify-center disabled:opacity-40"
              >
                {applying ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
                {applying ? 'Applying…' : `Apply ${grouped.safe.length} Existing-Game Score${grouped.safe.length === 1 ? '' : 's'}`}
              </button>
            </div>

            <div className="max-h-[620px] overflow-auto space-y-2">
              {rows.map((r: any, i: number) => (
                <div
                  key={`${r.gameId || 'x'}-${i}`}
                  className="rounded border border-white/10 bg-black/20 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <b className="text-white">
                        {r.away} {r.awayScore} at {r.home} {r.homeScore}
                      </b>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {r.date}
                        {r.sport ? ` · ${r.sport}` : ''}
                        {r.matched ? ` · matched ${r.matched.away} at ${r.matched.home}` : ''}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        r.safeToApply
                          ? 'text-emerald-300'
                          : r.bucket === 'verified'
                            ? 'text-sky-300'
                            : r.bucket === 'conflict'
                              ? 'text-red-300'
                              : 'text-amber-300'
                      }`}
                    >
                      {readable(r.bucket)}
                    </span>
                  </div>

                  {r.matched && (
                    <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Section X currently: {r.matched.currentAway ?? '—'}-{r.matched.currentHome ?? '—'} · {r.matched.currentStatus || 'unknown'} · schedule source {r.matched.currentSource || 'unknown'}
                    </div>
                  )}

                  {r.bucket === 'conflict' && (
                    <div className="text-xs mt-2 text-red-300">
                      Existing score protected. This paste will not overwrite it.
                    </div>
                  )}

                  {r.bucket === 'protected' && (
                    <div className="text-xs mt-2 text-amber-300">
                      Game is a scrimmage, postponed, or canceled. Left untouched.
                    </div>
                  )}

                  {r.candidateGameIds?.length > 0 && (
                    <div className="text-xs mt-2 text-amber-300">
                      {r.candidateGameIds.length} possible games matched. Left untouched.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="card p-4 text-sm">
        <h2 className="font-semibold text-white mb-2">Locked score-import rules</h2>
        <div className="space-y-1" style={{ color: 'var(--text-muted)' }}>
          <p>1. Score intake never creates a game.</p>
          <p>2. Only one exact existing matchup on the selected date and sport can be updated.</p>
          <p>3. Only a game with both scores blank can be filled.</p>
          <p>4. Any existing score is protected, even if the same source is pasted again later.</p>
          <p>5. A second protection check runs when you press Apply, so a live/manual score entered after preview still wins.</p>
          <p>6. The game’s Arbiter/schedule source is preserved; score intake does not take ownership of the game record.</p>
        </div>
      </div>
    </div>
  )
}
