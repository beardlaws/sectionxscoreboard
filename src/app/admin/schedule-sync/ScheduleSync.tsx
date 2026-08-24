'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { parseArbiterSchedule } from '@/lib/parser'
import type { ParsedGameRow, Season, Sport } from '@/types'

type TeamRecord = {
  id: string
  team_name: string
  sport_id: string
  level: string | null
  active: boolean | null
  school: {
    id: string
    school_name: string
    slug: string
    alias: string | null
  } | null
}

type DiffKind =
  | 'unchanged'
  | 'new'
  | 'date_changed'
  | 'time_changed'
  | 'location_changed'
  | 'status_changed'
  | 'details_changed'
  | 'possible_removed'
  | 'conflict'

type DiffRow = {
  key: string
  kind: DiffKind
  safe: boolean
  existing_game_id: string | null
  incoming: any | null
  existing: any | null
  changes: Array<{
    field: string
    before: string | number | boolean | null
    after: string | number | boolean | null
  }>
  note?: string
}

type CompareResult = {
  success: boolean
  scanned_at: string
  existing_count: number
  incoming_count: number
  safe_count: number
  review_count: number
  counts: Record<string, number>
  diffs: DiffRow[]
}

interface Props {
  teams: TeamRecord[]
  sports: Sport[]
  seasons: Season[]
}

function cleanLabel(value: string | null | undefined) {
  return value || 'Unknown'
}

function kindLabel(kind: DiffKind) {
  const map: Record<DiffKind, string> = {
    unchanged: 'UNCHANGED',
    new: 'NEW GAME',
    date_changed: 'DATE CHANGED',
    time_changed: 'TIME CHANGED',
    location_changed: 'LOCATION CHANGED',
    status_changed: 'STATUS CHANGED',
    details_changed: 'DETAILS CHANGED',
    possible_removed: 'POSSIBLE REMOVED',
    conflict: 'CONFLICT',
  }
  return map[kind]
}

function kindColor(kind: DiffKind) {
  if (kind === 'unchanged') return '#4ade80'
  if (kind === 'new') return '#60a5fa'
  if (kind === 'possible_removed' || kind === 'conflict') return '#f87171'
  return '#fbbf24'
}

export default function ScheduleSync({ teams, sports, seasons }: Props) {
  const varsityTeams = useMemo(
    () =>
      teams
        .filter(team =>
          team.active !== false &&
          (!team.level || team.level.toLowerCase().trim() === 'varsity')
        )
        .sort((a, b) => {
          const schoolA = a.school?.school_name || a.team_name
          const schoolB = b.school?.school_name || b.team_name
          return schoolA.localeCompare(schoolB)
        }),
    [teams]
  )

  const sportMap = useMemo(
    () => new Map(sports.map(sport => [sport.id, sport])),
    [sports]
  )

  const [teamId, setTeamId] = useState('')
  const [seasonId, setSeasonId] = useState(
    seasons.find(season => season.is_active)?.id || seasons[0]?.id || ''
  )
  const [arbiterUrl, setArbiterUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedGameRow[]>([])
  const [scanMeta, setScanMeta] = useState<{ teamName?: string | null; rowCount?: number; sourceUrl?: string } | null>(null)
  const [applyMessage, setApplyMessage] = useState<string | null>(null)

  const selectedTeam = varsityTeams.find(team => team.id === teamId) || null
  const selectedSport = selectedTeam ? sportMap.get(selectedTeam.sport_id) || null : null
  const selectedSeason = seasons.find(season => season.id === seasonId) || null

  const teamRecordsForSport = useMemo(() => {
    if (!selectedTeam) return []
    return teams
      .filter(team => team.sport_id === selectedTeam.sport_id)
      .map(team => ({
        id: team.id,
        team_name: team.team_name,
        school_name: team.school?.school_name || '',
        slug: team.school?.slug || '',
        aliases: team.school?.alias ? [team.school.alias] : [],
      }))
  }, [teams, selectedTeam])

  function resetResults() {
    setResult(null)
    setParsedRows([])
    setScanMeta(null)
    setError(null)
    setApplyMessage(null)
  }

  async function runScan() {
    if (!selectedTeam || !selectedSeason || !selectedSport || !arbiterUrl.trim()) return

    setLoading(true)
    setError(null)
    setApplyMessage(null)
    setResult(null)

    try {
      const arbiterResponse = await fetch('/api/admin/arbiter-team', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: arbiterUrl.trim() }),
      })

      const arbiter = await arbiterResponse.json()

      if (!arbiterResponse.ok || !arbiter.success) {
        throw new Error(arbiter.error || `Arbiter fetch failed (${arbiterResponse.status})`)
      }

      let rows = parseArbiterSchedule(arbiter.arbiterText, {
        teams: teamRecordsForSport,
        sourceTeamId: selectedTeam.id,
        defaultDate: new Date().toISOString().slice(0, 10),
        defaultSportId: selectedTeam.sport_id,
        defaultSeasonId: selectedSeason.id,
        year: selectedSeason.year,
      })

      rows = rows.map(row => ({
        ...row,
        approved: row.confidence === 'High',
      }))

      const highRows = rows.filter(row => row.confidence === 'High' && row.game_date)
      setParsedRows(rows)
      setScanMeta({ teamName: arbiter.teamName, rowCount: arbiter.rowCount, sourceUrl: arbiter.sourceUrl })

      const games = highRows.map(row => ({
        season_id: selectedSeason.id,
        sport_id: row.sport_id || selectedTeam.sport_id,
        game_date: row.game_date,
        game_time: row.game_time,
        location: row.location || null,
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
        notes: row.notes || null,
        parser_confidence: row.confidence,
        source: 'arbiter',
        verification_status: 'Reported',
      }))

      const compareResponse = await fetch('/api/admin/schedule-sync', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: selectedTeam.id,
          season_id: selectedSeason.id,
          sport_id: selectedTeam.sport_id,
          games,
        }),
      })

      const comparison = await compareResponse.json()

      if (!compareResponse.ok || !comparison.success) {
        throw new Error(comparison.error || `Comparison failed (${compareResponse.status})`)
      }

      setResult(comparison)
    } catch (err: any) {
      setError(err?.message || 'Could not scan this schedule.')
    } finally {
      setLoading(false)
    }
  }

  async function applySafeSync() {
    if (!result || !selectedTeam || !selectedSeason) return

    const safe = result.diffs.filter(diff => diff.safe && diff.incoming)
    if (!safe.length) return

    const meaningful = safe.filter(diff => diff.kind !== 'unchanged')
    const description = meaningful.length
      ? `${meaningful.length} detected schedule change${meaningful.length === 1 ? '' : 's'} plus source verification for unchanged games`
      : 'source verification timestamps for unchanged games'

    if (!window.confirm(`Apply ${description}?\n\nPossible removals and conflicts will NOT be changed.`)) return

    setApplying(true)
    setError(null)
    setApplyMessage(null)

    try {
      const games = safe.map(diff => ({
        ...(diff.existing_game_id ? { id: diff.existing_game_id } : {}),
        ...diff.incoming,
        season_id: selectedSeason.id,
        sport_id: selectedTeam.sport_id,
        source: 'arbiter',
        verification_status: 'Reported',
      }))

      const response = await fetch('/api/admin/games', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          games,
          import_team_id: selectedTeam.id,
          import_source: 'arbiter',
        }),
      })

      const publish = await response.json()

      if (!response.ok) {
        throw new Error(publish.error || `Sync apply failed (${response.status})`)
      }

      const errors = Array.isArray(publish.errors) ? publish.errors : []
      setApplyMessage(
        errors.length
          ? `Sync finished with ${errors.length} warning${errors.length === 1 ? '' : 's'}. Re-scan before making manual changes.`
          : `Safe sync applied to ${publish.published || games.length} game records. Re-scan now to verify the schedule is clean.`
      )
    } catch (err: any) {
      setError(err?.message || 'Could not apply schedule changes.')
    } finally {
      setApplying(false)
    }
  }

  const changedCount = result
    ? result.diffs.filter(diff => diff.safe && diff.kind !== 'unchanged').length
    : 0

  const unchangedCount = result?.counts?.unchanged || 0
  const reviewCount = result?.review_count || 0

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-[.22em] mb-2" style={{ color: '#60a5fa' }}>
            Section X Live Sync
          </div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Schedule Rescan & Change Detection
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Re-fetch an Arbiter schedule, compare it to Section X Scoreboard, and apply only safe changes. Removed games and conflicts are review-only.
          </p>
        </div>
        <Link href="/admin/schedule-audit" className="text-xs font-bold px-3 py-2 rounded-lg" style={{ color: '#93c5fd', border: '1px solid rgba(96,165,250,.25)', background: 'rgba(59,130,246,.07)' }}>
          Open Schedule Audit →
        </Link>
      </div>

      <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.18)' }}>
        <div className="font-bold text-sm" style={{ color: '#93c5fd' }}>How to use this during the season</div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Pick the internal team, paste its public Arbiter team schedule URL, and scan. A rescan recognizes date/time/location/status changes instead of blindly creating another game. Spring rainouts are exactly why this exists.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="label">Varsity Team</label>
          <select className="input w-full" value={teamId} onChange={event => { setTeamId(event.target.value); resetResults() }}>
            <option value="">Select team</option>
            {varsityTeams.map(team => {
              const sport = sportMap.get(team.sport_id)
              return (
                <option key={team.id} value={team.id}>
                  {team.school?.school_name || team.team_name} — {sport?.sport_name || team.team_name}
                </option>
              )
            })}
          </select>
        </div>

        <div>
          <label className="label">Season</label>
          <select className="input w-full" value={seasonId} onChange={event => { setSeasonId(event.target.value); resetResults() }}>
            {seasons.map(season => <option key={season.id} value={season.id}>{season.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Detected Sport</label>
          <div className="input w-full flex items-center" style={{ color: selectedSport ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {selectedSport?.sport_name || 'Select a team first'}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="label">Arbiter Team Schedule URL</label>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            className="input flex-1 font-mono text-sm"
            placeholder="https://arbiterlive.com/Teams/Schedule/12345?activeEntityId=6789"
            value={arbiterUrl}
            onChange={event => { setArbiterUrl(event.target.value); resetResults() }}
          />
          <button className="btn-primary whitespace-nowrap" onClick={runScan} disabled={loading || !teamId || !seasonId || !arbiterUrl.trim()}>
            {loading ? 'Scanning Arbiter...' : result ? 'Rescan Now' : 'Scan & Compare'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-3 mb-4 text-sm" style={{ color: '#f87171', background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.2)' }}>
          {error}
        </div>
      )}

      {applyMessage && (
        <div className="rounded-lg p-3 mb-4 text-sm" style={{ color: '#4ade80', background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.2)' }}>
          {applyMessage}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <Metric label="Fresh Rows" value={result.incoming_count} />
            <Metric label="Unchanged" value={unchangedCount} good />
            <Metric label="Safe Changes" value={changedCount} warn={changedCount > 0} />
            <Metric label="Needs Review" value={reviewCount} danger={reviewCount > 0} />
            <Metric label="Parsed Rows" value={parsedRows.length} />
          </div>

          <div className="rounded-xl p-4 mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3" style={{ background: reviewCount ? 'rgba(251,191,36,.055)' : 'rgba(74,222,128,.055)', border: `1px solid ${reviewCount ? 'rgba(251,191,36,.2)' : 'rgba(74,222,128,.2)'}` }}>
            <div>
              <div className="font-bold text-sm" style={{ color: reviewCount ? '#fbbf24' : '#4ade80' }}>
                {reviewCount ? `${reviewCount} item${reviewCount === 1 ? '' : 's'} require manual review` : 'No destructive conflicts detected'}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Scan source: {scanMeta?.teamName || selectedTeam?.school?.school_name || selectedTeam?.team_name} · {new Date(result.scanned_at).toLocaleString()}
              </div>
            </div>
            <button className="btn-primary" onClick={applySafeSync} disabled={applying || result.safe_count === 0}>
              {applying ? 'Applying Safe Sync...' : `Apply Safe Sync (${result.safe_count})`}
            </button>
          </div>

          <div className="space-y-3">
            {result.diffs
              .slice()
              .sort((a, b) => Number(a.safe) - Number(b.safe) || a.kind.localeCompare(b.kind))
              .map(diff => (
                <div key={diff.key} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: `1px solid ${diff.safe ? 'var(--border)' : 'rgba(248,113,113,.28)'}` }}>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black tracking-wide" style={{ color: kindColor(diff.kind) }}>{kindLabel(diff.kind)}</span>
                        {!diff.safe && <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ color: '#fca5a5', background: 'rgba(248,113,113,.08)' }}>MANUAL REVIEW ONLY</span>}
                      </div>
                      <div className="font-semibold mt-1">
                        {diff.incoming?.game_date || diff.existing?.game_date || 'No date'} · {selectedTeam?.school?.school_name || selectedTeam?.team_name}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Game ID: {diff.existing_game_id ? diff.existing_game_id.slice(0, 8) : 'new record'}
                      </div>
                    </div>
                    {diff.existing_game_id && (
                      <Link href={`/admin/game-center/${diff.existing_game_id}`} className="text-xs font-bold" style={{ color: '#93c5fd' }}>
                        Open Game Center →
                      </Link>
                    )}
                  </div>

                  {diff.changes.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-3">
                      {diff.changes.map(change => (
                        <div key={change.field} className="rounded-lg p-2 text-xs" style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
                          <div className="font-bold uppercase tracking-wide mb-1" style={{ color: '#fbbf24' }}>{change.field.replaceAll('_', ' ')}</div>
                          <div style={{ color: 'var(--text-muted)' }}>Before: <span style={{ color: 'var(--text-secondary)' }}>{String(change.before ?? '—')}</span></div>
                          <div style={{ color: 'var(--text-muted)' }}>Fresh: <span style={{ color: '#e2e8f0' }}>{String(change.after ?? '—')}</span></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {diff.note && <div className="text-xs mt-3" style={{ color: '#fca5a5' }}>{diff.note}</div>}

                  {diff.kind === 'unchanged' && (
                    <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      No schedule fields changed. Applying the safe sync refreshes this team's Arbiter source verification timestamp.
                    </div>
                  )}
                </div>
              ))}
          </div>

          <div className="rounded-lg p-4 mt-4 text-xs" style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Safety rule:</strong> Possible removals and home/away conflicts are never auto-applied. Verify them in Arbiter or with the opposing school first. After applying safe changes, hit <strong>Rescan Now</strong> and then check Schedule Audit.
          </div>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, good = false, warn = false, danger = false }: { label: string; value: number; good?: boolean; warn?: boolean; danger?: boolean }) {
  const color = danger ? '#f87171' : warn ? '#fbbf24' : good ? '#4ade80' : 'var(--text-primary)'
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color }}>{value}</div>
    </div>
  )
}
