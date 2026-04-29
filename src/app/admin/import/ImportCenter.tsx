// src/app/admin/import/ImportCenter.tsx
'use client'

import { useState, useMemo } from 'react'
import { parsePastedGames } from '@/lib/parser'
import { format } from 'date-fns'
import type { ParsedGameRow, Sport, Season } from '@/types'

interface Team {
  id: string
  team_name: string
  sport_id: string
  school: { school_name: string; alias: string; primary_color: string; slug: string } | null
}

interface Props {
  teams: Team[]
  sports: Sport[]
  seasons: Season[]
}

type Tab = 'paste' | 'csv' | 'arbiter' | 'history'

export default function ImportCenter({ teams, sports, seasons }: Props) {
  const [tab, setTab] = useState<Tab>('paste')
  const [pasteText, setPasteText] = useState('')
  const [defaultDate, setDefaultDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [defaultSportId, setDefaultSportId] = useState('')
  const [defaultSeasonId, setDefaultSeasonId] = useState(
    seasons.find(s => s.is_active)?.id || seasons[0]?.id || ''
  )
  const [parsedRows, setParsedRows] = useState<ParsedGameRow[]>([])
  const [step, setStep] = useState<'input' | 'review' | 'done'>('input')
  const [publishing, setPublishing] = useState(false)
  const [skipNonFinal, setSkipNonFinal] = useState(true)
  const [publishResult, setPublishResult] = useState<{ published: number; skipped: number; errors?: string[]; errorMsg?: string } | null>(null)

  const teamRecords = useMemo(() =>
    teams.map(t => ({
      id: t.id,
      team_name: t.team_name,
      school_name: t.school?.school_name || '',
      slug: t.school?.slug || '',
      aliases: t.school?.alias ? [t.school.alias] : [],
    })),
    [teams]
  )

  const handleParse = () => {
    if (!pasteText.trim()) return
    let rows = parsePastedGames(pasteText, {
      teams: teamRecords,
      defaultDate,
      defaultSportId,
      defaultSeasonId,
    })
    if (skipNonFinal) {
      rows = rows.filter(r => r.status !== 'Postponed' && r.status !== 'Canceled')
    }
    // Auto-approve all High confidence rows
    rows = rows.map(r => r.confidence === 'High' ? { ...r, approved: true } : r)
    setParsedRows(rows)
    setStep('review')
  }

  const toggleApprove = (id: string) => {
    setParsedRows(prev => prev.map(r =>
      r.id === id && r.confidence !== 'Low' ? { ...r, approved: !r.approved } : r
    ))
  }

  const approveAll = () => {
    setParsedRows(prev => prev.map(r =>
      r.confidence !== 'Low' ? { ...r, approved: true } : r
    ))
  }

  const approveHigh = () => {
    setParsedRows(prev => prev.map(r =>
      r.confidence === 'High' ? { ...r, approved: true } : r
    ))
  }

  const updateRow = (id: string, updates: Partial<ParsedGameRow>) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  const handlePublish = async () => {
    const toPublish = parsedRows.filter(r => r.approved)
    if (toPublish.length === 0) return
    setPublishing(true)

    const games = toPublish
      .filter(row => row.game_date)
      .map(row => ({
        season_id: defaultSeasonId || null,
        sport_id: row.sport_id || defaultSportId || null,
        game_date: row.game_date,
        game_time: row.game_time,
        home_team_id: row.home_team_id || null,
        away_team_id: row.away_team_id || null,
        external_home_name: row.external_home_name || null,
        external_away_name: row.external_away_name || null,
        home_score: row.home_score,
        away_score: row.away_score,
        status: row.status,
        rescheduled_date: row.rescheduled_date,
        game_number: row.game_number,
        neutral_site: row.neutral_site,
        event_name: row.event_name,
        parser_confidence: row.confidence,
        source: 'bulk_paste',
        verification_status: 'Reported',
      }))

    try {
      const res = await fetch('/api/admin/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(games),
      })
      const result = await res.json()
      if (!res.ok) {
        setPublishResult({ published: 0, skipped: toPublish.length, errorMsg: result.error || 'Server error ' + res.status })
      } else {
        setPublishResult({ published: result.published || 0, skipped: result.skipped || 0, errors: result.errors })
      }
    } catch (e: any) {
      setPublishResult({ published: 0, skipped: toPublish.length, errorMsg: e.message })
    }

    setStep('done')
    setPublishing(false)
  }

  const reset = () => {
    setPasteText('')
    setParsedRows([])
    setStep('input')
    setPublishResult(null)
  }

  const approvedCount = parsedRows.filter(r => r.approved).length
  const highConfidence = parsedRows.filter(r => r.confidence === 'High').length
  const mediumConfidence = parsedRows.filter(r => r.confidence === 'Medium').length
  const lowConfidence = parsedRows.filter(r => r.confidence === 'Low').length

  return (
    <div className="p-4 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>Import Center</h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        Paste scores or schedules, review parsed rows, then approve to publish.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { id: 'paste', label: 'Bulk Paste' },
          { id: 'csv', label: 'CSV Upload' },
          { id: 'arbiter', label: 'Arbiter Import' },
        ] as const).map(t => (
          <button
            key={t.id}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors`}
            style={{
              borderColor: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? 'var(--accent-bright)' : 'var(--text-muted)',
              fontFamily: 'var(--font-display)',
            }}
            onClick={() => { setTab(t.id); setStep('input'); setParsedRows([]) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {step === 'done' ? (
        <div className="card p-8 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Import Complete
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {publishResult?.published} game{publishResult?.published !== 1 ? 's' : ''} published
            {(publishResult?.skipped || 0) > 0 && ` · ${publishResult!.skipped} skipped`}
          </p>
          {publishResult?.errorMsg && <p style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{publishResult.errorMsg}</p>}
          {publishResult?.errors?.map((e, i) => <p key={i} style={{ color: '#f87171', fontSize: 11 }}>{e}</p>)}
          <button className="btn-primary mt-4" onClick={reset}>New Import</button>
        </div>
      ) : step === 'input' ? (
        <div className="space-y-4">
          {/* Settings row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Default Date</label>
              <input className="input" type="date" value={defaultDate} onChange={e => setDefaultDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Sport <span className="text-amber-400 text-xs">(select for accuracy)</span></label>
              <select className="input" value={defaultSportId} onChange={e => setDefaultSportId(e.target.value)}>
                <option value="">Auto-detect</option>
                {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name} ({s.gender})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Season</label>
              <select className="input" value={defaultSeasonId} onChange={e => setDefaultSeasonId(e.target.value)}>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {tab === 'paste' && (
            <>
              <div>
                <label className="label">Paste Scores or Schedule</label>
                <textarea
                  className="input font-mono text-sm"
                  rows={12}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={`Canton 8, Potsdam 3 Final
Massena 12, OFA 7 Final
Madrid-Waddington 11, St. Lawrence Central 1 Final
Lisbon at Madrid-Waddington, canceled
Heuvelton 5, Brushton-Moira 3 (2nd game)
PH at BM 3:30`}
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button 
                  className="btn-primary" 
                  onClick={handleParse} 
                  disabled={!pasteText.trim()}
                  title={!defaultSportId ? 'Select a sport above for best results' : ''}
                >
                  Parse & Review →
                </button>
                {!defaultSportId && (
                  <span className="text-xs text-amber-400">⚠ Select a sport for accurate imports</span>
                )}
                <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={skipNonFinal} onChange={e => setSkipNonFinal(e.target.checked)} />
                  Skip postponed &amp; canceled
                </label>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Paste the full schedule — dates like "FRIDAY, APRIL 17" are read automatically.
                </span>
              </div>
            </>
          )}

          {tab === 'csv' && (
            <div className="card p-6 text-center" style={{ border: '2px dashed var(--border)' }}>
              <div className="text-3xl mb-2">📄</div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>CSV import coming soon</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Format: date, home_team, away_team, home_score, away_score, sport, status
              </p>
            </div>
          )}

          {tab === 'arbiter' && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Paste exported Arbiter schedule text below.
              </p>
              <textarea
                className="input font-mono text-sm"
                rows={12}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste Arbiter schedule export here..."
              />
              <button className="btn-primary" onClick={handleParse} disabled={!pasteText.trim()}>
                Parse & Review →
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Review step */
        <div>
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {parsedRows.length} rows parsed
            </span>
            <span className="confidence-high text-xs">✓ {highConfidence} high</span>
            <span className="confidence-medium text-xs">~ {mediumConfidence} medium</span>
            <span className="confidence-low text-xs">⚠ {lowConfidence} low</span>
            <div className="flex-1" />
            <button className="btn-ghost text-xs py-1 px-2" onClick={approveHigh}>Approve High Only</button>
            <button className="btn-ghost text-xs py-1 px-2" onClick={approveAll}>Approve All Valid</button>
            <button className="btn-primary text-xs py-1 px-2" onClick={handlePublish} disabled={approvedCount === 0 || publishing}>
              {publishing ? 'Publishing...' : `Publish ${approvedCount} Selected`}
            </button>
            <button className="btn-ghost text-xs py-1 px-2" onClick={reset}>← Back</button>
          </div>

          {/* Row table */}
          <div className="space-y-2">
            {parsedRows.map(row => (
              <div
                key={row.id}
                className="rounded-lg p-3"
                style={{
                  background: row.approved ? 'rgba(34,197,94,0.05)' : 'var(--bg-card)',
                  border: `1px solid ${row.approved ? 'rgba(34,197,94,0.2)' : row.confidence === 'Low' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Approve checkbox */}
                  <input
                    type="checkbox"
                    className="mt-1 flex-shrink-0"
                    checked={row.approved}
                    disabled={row.confidence === 'Low'}
                    onChange={() => toggleApprove(row.id)}
                  />
                  <div className="flex-1 min-w-0">
                    {/* Raw line */}
                    <div className="text-xs mb-2 font-mono" style={{ color: 'var(--text-muted)' }}>
                      {row.raw}
                    </div>

                    {/* Parsed fields */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div>
                        <div className="section-label mb-0.5" style={{ fontSize: '9px' }}>Away</div>
                        <div className={row.away_team_id ? 'confidence-high' : 'confidence-low'}>
                          {row.away_team_match || row.away_team_name || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="section-label mb-0.5" style={{ fontSize: '9px' }}>Home</div>
                        <div className={row.home_team_id ? 'confidence-high' : 'confidence-low'}>
                          {row.home_team_match || row.home_team_name || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="section-label mb-0.5" style={{ fontSize: '9px' }}>Score</div>
                        <div style={{ color: 'var(--text-primary)' }}>
                          {row.away_score !== null && row.home_score !== null
                            ? `${row.away_score} – ${row.home_score}`
                            : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="section-label mb-0.5" style={{ fontSize: '9px' }}>Status / Date</div>
                        <div>
                          <span className={`badge text-xs ${row.status === 'Final' ? 'badge-final' : row.status === 'Scheduled' ? 'badge-scheduled' : row.status === 'Postponed' ? 'badge-postponed' : 'badge-canceled'}`}>
                            {row.status}
                          </span>
                          <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>{row.game_date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Confidence notes */}
                    {row.confidence === 'Low' && (
                      <div className="mt-2 text-xs confidence-low">
                        ⚠ Low confidence — manual correction required: {row.confidence_notes.join(' · ')}
                      </div>
                    )}
                    {row.confidence === 'Medium' && (
                      <div className="mt-1 text-xs confidence-medium">
                        ~ {row.confidence_notes.filter(n => n.includes('match')).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
