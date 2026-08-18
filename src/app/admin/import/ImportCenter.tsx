// src/app/admin/import/ImportCenter.tsx
'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  parseArbiterSchedule,
  parsePastedGames,
} from '@/lib/parser'
import type {
  ParsedGameRow,
  Season,
  Sport,
} from '@/types'

interface Team {
  id: string
  team_name: string
  sport_id: string
  school: {
    school_name: string
    alias: string
    primary_color: string
    slug: string
  } | null
}

interface Props {
  teams: Team[]
  sports: Sport[]
  seasons: Season[]
}

type Tab = 'paste' | 'csv' | 'arbiter'

export default function ImportCenter({
  teams,
  sports,
  seasons,
}: Props) {
  const [tab, setTab] = useState<Tab>('paste')
  const [pasteText, setPasteText] = useState('')

  const [defaultDate, setDefaultDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  )

  const [defaultSportId, setDefaultSportId] =
    useState('')

  const [defaultSeasonId, setDefaultSeasonId] =
    useState(
      seasons.find(season => season.is_active)?.id ||
        seasons[0]?.id ||
        ''
    )

  const [arbiterTeamId, setArbiterTeamId] =
    useState('')

  const [parsedRows, setParsedRows] = useState<
    ParsedGameRow[]
  >([])

  const [step, setStep] = useState<
    'input' | 'review' | 'done'
  >('input')

  const [publishing, setPublishing] =
    useState(false)

  const [skipNonFinal, setSkipNonFinal] =
    useState(true)

  const [publishResult, setPublishResult] =
    useState<{
      published: number
      skipped: number
      errors?: string[]
      trackingErrors?: string[]
      errorMsg?: string
    } | null>(null)

  // Only teams for the selected sport are sent to the parser.
  const teamRecords = useMemo(() => {
    const filtered = defaultSportId
      ? teams.filter(
          team => team.sport_id === defaultSportId
        )
      : teams

    return filtered.map(team => ({
      id: team.id,
      team_name: team.team_name,
      school_name: team.school?.school_name || '',
      slug: team.school?.slug || '',
      aliases: team.school?.alias
        ? [team.school.alias]
        : [],
    }))
  }, [teams, defaultSportId])

  const selectedSeason = useMemo(
    () =>
      seasons.find(
        season => season.id === defaultSeasonId
      ),
    [seasons, defaultSeasonId]
  )

  const selectedArbiterTeam = useMemo(
    () =>
      teamRecords.find(
        team => team.id === arbiterTeamId
      ),
    [teamRecords, arbiterTeamId]
  )

  const handleParse = () => {
    if (!pasteText.trim()) return

    let rows: ParsedGameRow[] = []

    if (tab === 'arbiter') {
      if (!defaultSportId || !arbiterTeamId) {
        return
      }

      const seasonYear =
        selectedSeason?.year ||
        Number(defaultDate.slice(0, 4)) ||
        new Date().getFullYear()

      rows = parseArbiterSchedule(pasteText, {
        teams: teamRecords,
        sourceTeamId: arbiterTeamId,
        defaultDate,
        defaultSportId,
        defaultSeasonId,
        year: seasonYear,
      })
    } else {
      rows = parsePastedGames(pasteText, {
        teams: teamRecords,
        defaultDate,
        defaultSportId,
        defaultSeasonId,
      })
    }

    if (skipNonFinal) {
      rows = rows.filter(
        row =>
          row.status !== 'Postponed' &&
          row.status !== 'Canceled'
      )
    }

    rows = rows.map(row =>
      row.confidence === 'High'
        ? {
            ...row,
            approved: true,
          }
        : row
    )

    setParsedRows(rows)
    setStep('review')
  }

  const toggleApprove = (id: string) => {
    setParsedRows(previous =>
      previous.map(row =>
        row.id === id &&
        row.confidence !== 'Low'
          ? {
              ...row,
              approved: !row.approved,
            }
          : row
      )
    )
  }

  const approveAll = () => {
    setParsedRows(previous =>
      previous.map(row =>
        row.confidence !== 'Low'
          ? {
              ...row,
              approved: true,
            }
          : row
      )
    )
  }

  const approveHigh = () => {
    setParsedRows(previous =>
      previous.map(row =>
        row.confidence === 'High'
          ? {
              ...row,
              approved: true,
            }
          : row
      )
    )
  }

  const handlePublish = async () => {
    const toPublish = parsedRows.filter(
      row => row.approved
    )

    if (toPublish.length === 0) return

    setPublishing(true)

    const games = toPublish
      .filter(row => row.game_date)
      .map(row => ({
        season_id: defaultSeasonId || null,

        sport_id:
          row.sport_id ||
          defaultSportId ||
          null,

        game_date: row.game_date,
        game_time: row.game_time,

        location: row.location || null,

        home_team_id:
          row.home_team_id || null,

        away_team_id:
          row.away_team_id || null,

        external_home_name:
          row.external_home_name || null,

        external_away_name:
          row.external_away_name || null,

        home_score: row.home_score,
        away_score: row.away_score,

        status: row.status,

        rescheduled_date:
          row.rescheduled_date,

        game_number: row.game_number,

        neutral_site: row.neutral_site,

        event_name: row.event_name,

        notes: row.notes || null,

        parser_confidence:
          row.confidence,

        source:
          tab === 'arbiter'
            ? 'arbiter'
            : 'bulk_paste',

        verification_status:
          'Reported',
      }))

    try {
      /*
        Arbiter imports use the NEW request format.

        The API now knows which team's schedule
        produced these games, allowing the audit
        system to track schedule completion.

        Bulk Paste continues to work too.
      */
      const requestBody =
        tab === 'arbiter'
          ? {
              games,
              import_team_id:
                arbiterTeamId,
              import_source:
                'arbiter',
            }
          : {
              games,
              import_source:
                'bulk_paste',
            }

      const response = await fetch(
        '/api/admin/games',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(
            requestBody
          ),
        }
      )

      const result =
        await response.json()

      if (!response.ok) {
        setPublishResult({
          published: 0,
          skipped:
            toPublish.length,
          errorMsg:
            result.error ||
            `Server error ${response.status}`,
        })
      } else {
        setPublishResult({
          published:
            result.published || 0,

          skipped:
            result.skipped || 0,

          errors:
            result.errors || [],

          trackingErrors:
            result.tracking_errors ||
            [],
        })
      }
    } catch (error: any) {
      setPublishResult({
        published: 0,
        skipped:
          toPublish.length,
        errorMsg:
          error.message,
      })
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

  const approvedCount =
    parsedRows.filter(
      row => row.approved
    ).length

  const highConfidence =
    parsedRows.filter(
      row =>
        row.confidence === 'High'
    ).length

  const mediumConfidence =
    parsedRows.filter(
      row =>
        row.confidence === 'Medium'
    ).length

  const lowConfidence =
    parsedRows.filter(
      row =>
        row.confidence === 'Low'
    ).length

  return (
    <div className="p-4 max-w-5xl">
      <h1
        className="text-2xl font-bold mb-1"
        style={{
          fontFamily:
            'var(--font-display)',
        }}
      >
        Import Center
      </h1>

      <p
        className="text-sm mb-5"
        style={{
          color:
            'var(--text-secondary)',
        }}
      >
        Paste scores or schedules,
        review parsed rows, then
        approve to publish.
      </p>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-5 border-b"
        style={{
          borderColor:
            'var(--border)',
        }}
      >
        {(
          [
            {
              id: 'paste',
              label: 'Bulk Paste',
            },
            {
              id: 'csv',
              label: 'CSV Upload',
            },
            {
              id: 'arbiter',
              label: 'Arbiter Import',
            },
          ] as const
        ).map(item => (
          <button
            key={item.id}
            className="px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors"
            style={{
              borderColor:
                tab === item.id
                  ? 'var(--accent)'
                  : 'transparent',

              color:
                tab === item.id
                  ? 'var(--accent-bright)'
                  : 'var(--text-muted)',

              fontFamily:
                'var(--font-display)',
            }}
            onClick={() => {
              setTab(item.id)
              setStep('input')
              setParsedRows([])
              setPublishResult(null)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {step === 'done' ? (
        <div className="card p-8 text-center">
          <div className="text-5xl mb-3">
            ✅
          </div>

          <h2
            className="text-xl font-bold mb-2"
            style={{
              fontFamily:
                'var(--font-display)',
            }}
          >
            Import Complete
          </h2>

          <p
            style={{
              color:
                'var(--text-secondary)',
            }}
          >
            {publishResult?.published}{' '}
            game
            {publishResult?.published !== 1
              ? 's'
              : ''}{' '}
            processed
            {(publishResult?.skipped || 0) >
              0 &&
              ` · ${publishResult?.skipped} skipped`}
          </p>

          {tab === 'arbiter' &&
            selectedArbiterTeam && (
              <p
                className="text-xs mt-2"
                style={{
                  color:
                    'var(--text-muted)',
                }}
              >
                Schedule import tracked
                for{' '}
                <strong>
                  {
                    selectedArbiterTeam.school_name
                  }
                </strong>
              </p>
            )}

          {publishResult?.errorMsg && (
            <p
              className="mt-3 text-xs"
              style={{
                color: '#f87171',
              }}
            >
              {publishResult.errorMsg}
            </p>
          )}

          {publishResult?.errors?.map(
            (error, index) => (
              <p
                key={`error-${index}`}
                className="text-xs mt-1"
                style={{
                  color: '#f87171',
                }}
              >
                {error}
              </p>
            )
          )}

          {publishResult?.trackingErrors?.map(
            (error, index) => (
              <p
                key={`tracking-${index}`}
                className="text-xs mt-1"
                style={{
                  color: '#fbbf24',
                }}
              >
                Tracking warning: {error}
              </p>
            )
          )}

          <button
            className="btn-primary mt-4"
            onClick={reset}
          >
            New Import
          </button>
        </div>
      ) : step === 'input' ? (
        <div className="space-y-4">
          {/* Main settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">
                Default Date
              </label>

              <input
                className="input"
                type="date"
                value={defaultDate}
                onChange={event =>
                  setDefaultDate(
                    event.target.value
                  )
                }
              />
            </div>

            <div>
              <label className="label">
                Sport{' '}
                <span className="text-red-400 text-xs font-bold">
                  * Required
                </span>
              </label>

              <select
                className="input"
                value={defaultSportId}
                onChange={event => {
                  setDefaultSportId(
                    event.target.value
                  )
                  setArbiterTeamId('')
                }}
              >
                <option value="">
                  Auto-detect
                </option>

                {sports.map(sport => (
                  <option
                    key={sport.id}
                    value={sport.id}
                  >
                    {sport.sport_name}{' '}
                    ({sport.gender})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">
                Season
              </label>

              <select
                className="input"
                value={defaultSeasonId}
                onChange={event =>
                  setDefaultSeasonId(
                    event.target.value
                  )
                }
              >
                {seasons.map(
                  season => (
                    <option
                      key={season.id}
                      value={season.id}
                    >
                      {season.name}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* Bulk Paste */}
          {tab === 'paste' && (
            <>
              <div>
                <label className="label">
                  Paste Scores or
                  Schedule
                </label>

                <textarea
                  className="input font-mono text-sm"
                  rows={12}
                  value={pasteText}
                  onChange={event =>
                    setPasteText(
                      event.target.value
                    )
                  }
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
                  disabled={
                    !pasteText.trim() ||
                    !defaultSportId
                  }
                >
                  Parse & Review →
                </button>

                {!defaultSportId && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                    ⚠️ Select a sport
                    before parsing.
                  </div>
                )}

                <label
                  className="flex items-center gap-2 cursor-pointer text-sm"
                  style={{
                    color:
                      'var(--text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      skipNonFinal
                    }
                    onChange={event =>
                      setSkipNonFinal(
                        event.target
                          .checked
                      )
                    }
                  />

                  Skip postponed &
                  canceled
                </label>
              </div>
            </>
          )}

          {/* CSV */}
          {tab === 'csv' && (
            <div
              className="card p-6 text-center"
              style={{
                border:
                  '2px dashed var(--border)',
              }}
            >
              <div className="text-3xl mb-2">
                📄
              </div>

              <p
                className="text-sm"
                style={{
                  color:
                    'var(--text-secondary)',
                }}
              >
                CSV import coming
                soon
              </p>
            </div>
          )}

          {/* Arbiter */}
          {tab === 'arbiter' && (
            <div className="space-y-4">
              <div>
                <label className="label">
                  Schedule For{' '}
                  <span className="text-red-400 text-xs font-bold">
                    * Required
                  </span>
                </label>

                <select
                  className="input"
                  value={arbiterTeamId}
                  onChange={event =>
                    setArbiterTeamId(
                      event.target.value
                    )
                  }
                  disabled={
                    !defaultSportId
                  }
                >
                  <option value="">
                    {defaultSportId
                      ? 'Select the team whose Arbiter schedule you copied'
                      : 'Select a sport first'}
                  </option>

                  {teamRecords
                    .slice()
                    .sort((a, b) =>
                      a.school_name.localeCompare(
                        b.school_name
                      )
                    )
                    .map(team => (
                      <option
                        key={team.id}
                        value={team.id}
                      >
                        {team.school_name ||
                          team.team_name}
                      </option>
                    ))}
                </select>

                <p
                  className="text-xs mt-1"
                  style={{
                    color:
                      'var(--text-muted)',
                  }}
                >
                  This selection is
                  also used to track
                  whether this team's
                  full Arbiter schedule
                  has been imported.
                </p>
              </div>

              {selectedArbiterTeam && (
                <div
                  className="rounded-lg p-3"
                  style={{
                    background:
                      'var(--bg-card)',
                    border:
                      '1px solid var(--border)',
                  }}
                >
                  <div
                    className="text-xs"
                    style={{
                      color:
                        'var(--text-muted)',
                    }}
                  >
                    Schedule source
                  </div>

                  <div
                    className="font-semibold"
                    style={{
                      color:
                        'var(--text-primary)',
                    }}
                  >
                    {
                      selectedArbiterTeam.school_name
                    }
                  </div>

                  <div
                    className="text-xs mt-1"
                    style={{
                      color:
                        'var(--text-secondary)',
                    }}
                  >
                    Every published game
                    from this import will
                    be credited to this
                    team's Arbiter
                    schedule.
                  </div>
                </div>
              )}

              <div>
                <label className="label">
                  Paste Arbiter
                  Schedule
                </label>

                <textarea
                  className="input font-mono text-sm"
                  rows={12}
                  value={pasteText}
                  onChange={event =>
                    setPasteText(
                      event.target.value
                    )
                  }
                  placeholder="Paste the full Arbiter schedule here..."
                />
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  className="btn-primary"
                  onClick={handleParse}
                  disabled={
                    !pasteText.trim() ||
                    !defaultSportId ||
                    !arbiterTeamId
                  }
                >
                  Parse & Review →
                </button>

                <label
                  className="flex items-center gap-2 cursor-pointer text-sm"
                  style={{
                    color:
                      'var(--text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      skipNonFinal
                    }
                    onChange={event =>
                      setSkipNonFinal(
                        event.target
                          .checked
                      )
                    }
                  />

                  Skip postponed &
                  canceled
                </label>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Review */
        <div>
          <div
            className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg"
            style={{
              background:
                'var(--bg-card)',
              border:
                '1px solid var(--border)',
            }}
          >
            <span
              className="text-sm font-semibold"
              style={{
                color:
                  'var(--text-primary)',
              }}
            >
              {parsedRows.length}{' '}
              rows parsed
            </span>

            <span className="confidence-high text-xs">
              ✓ {highConfidence} high
            </span>

            <span className="confidence-medium text-xs">
              ~ {mediumConfidence}{' '}
              medium
            </span>

            <span className="confidence-low text-xs">
              ⚠ {lowConfidence} low
            </span>

            <div className="flex-1" />

            <button
              className="btn-ghost text-xs py-1 px-2"
              onClick={approveHigh}
            >
              Approve High Only
            </button>

            <button
              className="btn-ghost text-xs py-1 px-2"
              onClick={approveAll}
            >
              Approve All Valid
            </button>

            <button
              className="btn-primary text-xs py-1 px-2"
              onClick={
                handlePublish
              }
              disabled={
                approvedCount === 0 ||
                publishing
              }
            >
              {publishing
                ? 'Publishing...'
                : `Publish ${approvedCount} Selected`}
            </button>

            <button
              className="btn-ghost text-xs py-1 px-2"
              onClick={reset}
            >
              ← Back
            </button>
          </div>

          {tab === 'arbiter' &&
            selectedArbiterTeam && (
              <div
                className="mb-4 rounded-lg px-3 py-2 text-xs"
                style={{
                  background:
                    'rgba(59,130,246,0.08)',
                  border:
                    '1px solid rgba(59,130,246,0.2)',
                  color:
                    'var(--text-secondary)',
                }}
              >
                Publishing these games
                will mark{' '}
                <strong
                  style={{
                    color:
                      'var(--text-primary)',
                  }}
                >
                  {
                    selectedArbiterTeam.school_name
                  }
                </strong>{' '}
                as the Arbiter schedule
                source.
              </div>
            )}

          <div className="space-y-2">
            {parsedRows.map(row => (
              <div
                key={row.id}
                className="rounded-lg p-3"
                style={{
                  background:
                    row.approved
                      ? 'rgba(34,197,94,0.05)'
                      : 'var(--bg-card)',

                  border: `1px solid ${
                    row.approved
                      ? 'rgba(34,197,94,0.2)'
                      : row.confidence ===
                          'Low'
                        ? 'rgba(239,68,68,0.3)'
                        : 'var(--border)'
                  }`,
                }}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 flex-shrink-0"
                    checked={
                      row.approved
                    }
                    disabled={
                      row.confidence ===
                      'Low'
                    }
                    onChange={() =>
                      toggleApprove(
                        row.id
                      )
                    }
                  />

                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs mb-2 font-mono"
                      style={{
                        color:
                          'var(--text-muted)',
                      }}
                    >
                      {row.raw}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div>
                        <div
                          className="section-label mb-0.5"
                          style={{
                            fontSize:
                              '9px',
                          }}
                        >
                          Away
                        </div>

                        <div
                          className={
                            row.away_team_id
                              ? 'confidence-high'
                              : row.external_away_name
                                ? 'confidence-medium'
                                : 'confidence-low'
                          }
                        >
                          {row.away_team_match ||
                            row.away_team_name ||
                            '—'}
                        </div>
                      </div>

                      <div>
                        <div
                          className="section-label mb-0.5"
                          style={{
                            fontSize:
                              '9px',
                          }}
                        >
                          Home
                        </div>

                        <div
                          className={
                            row.home_team_id
                              ? 'confidence-high'
                              : row.external_home_name
                                ? 'confidence-medium'
                                : 'confidence-low'
                          }
                        >
                          {row.home_team_match ||
                            row.home_team_name ||
                            '—'}
                        </div>
                      </div>

                      <div>
                        <div
                          className="section-label mb-0.5"
                          style={{
                            fontSize:
                              '9px',
                          }}
                        >
                          Score
                        </div>

                        <div
                          style={{
                            color:
                              'var(--text-primary)',
                          }}
                        >
                          {row.away_score !==
                            null &&
                          row.home_score !==
                            null
                            ? `${row.away_score} – ${row.home_score}`
                            : '—'}
                        </div>
                      </div>

                      <div>
                        <div
                          className="section-label mb-0.5"
                          style={{
                            fontSize:
                              '9px',
                          }}
                        >
                          Status / Date
                        </div>

                        <div>
                          <span
                            className={`badge text-xs ${
                              row.status ===
                              'Final'
                                ? 'badge-final'
                                : row.status ===
                                    'Scheduled'
                                  ? 'badge-scheduled'
                                  : row.status ===
                                      'Postponed'
                                    ? 'badge-postponed'
                                    : 'badge-canceled'
                            }`}
                          >
                            {row.status}
                          </span>

                          <span
                            className="ml-1 text-xs"
                            style={{
                              color:
                                'var(--text-muted)',
                            }}
                          >
                            {
                              row.game_date
                            }
                          </span>
                        </div>
                      </div>
                    </div>

                    {(row.game_time ||
                      row.location ||
                      row.notes) && (
                      <div
                        className="mt-2 text-xs"
                        style={{
                          color:
                            'var(--text-secondary)',
                        }}
                      >
                        {row.game_time && (
                          <span>
                            Time:{' '}
                            {
                              row.game_time
                            }
                          </span>
                        )}

                        {row.location && (
                          <span>
                            {row.game_time
                              ? ' · '
                              : ''}
                            Location:{' '}
                            {row.location}
                          </span>
                        )}

                        {row.notes && (
                          <span>
                            {row.game_time ||
                            row.location
                              ? ' · '
                              : ''}
                            {row.notes}
                          </span>
                        )}
                      </div>
                    )}

                    {row.confidence ===
                      'Low' && (
                      <div className="mt-2 text-xs confidence-low">
                        ⚠ Low confidence
                        — manual correction
                        required:{' '}
                        {row.confidence_notes.join(
                          ' · '
                        )}
                      </div>
                    )}

                    {row.confidence ===
                      'Medium' && (
                      <div className="mt-1 text-xs confidence-medium">
                        ~{' '}
                        {row.confidence_notes.join(
                          ' · '
                        )}
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
