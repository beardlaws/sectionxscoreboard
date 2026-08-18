// src/app/admin/schedule-audit/ScheduleAudit.tsx
'use client'

import { useMemo, useState } from 'react'
import type {
  Season,
  Sport,
} from '@/types'

interface TeamRecord {
  id: string
  team_name: string
  sport_id: string
  level: string | null
  active: boolean | null
  school: {
    id: string
    school_name: string
    alias: string | null
    slug: string
    primary_color: string | null
  } | null
}

interface GameRecord {
  id: string
  season_id: string
  sport_id: string
  home_team_id: string | null
  away_team_id: string | null
  external_home_opponent_id:
    | string
    | null
  external_away_opponent_id:
    | string
    | null
  game_date: string
  game_time: string | null
  location: string | null
  status: string
  parser_confidence:
    | string
    | null
  game_number: number | null
}

interface ImportSourceRecord {
  id: string
  game_id: string
  team_id: string
  season_id: string
  sport_id: string
  source: string
  imported_at: string
}

interface Props {
  teams: TeamRecord[]
  sports: Sport[]
  seasons: Season[]
  games: GameRecord[]
  importSources:
    ImportSourceRecord[]
}

interface TeamAudit {
  team: TeamRecord
  gameCount: number
  scheduleImported: boolean
  confirmedCount: number
  singleSourceCount: number
  issueCount: number
  lastImportedAt: string | null
}

function isVarsityTeam(
  team: TeamRecord
) {
  if (!team.level) return true

  return (
    team.level
      .toLowerCase()
      .trim() === 'varsity'
  )
}

export default function ScheduleAudit({
  teams,
  sports,
  seasons,
  games,
  importSources,
}: Props) {
  const defaultSeason =
    seasons.find(
      season =>
        season.is_active
    ) || seasons[0]

  const [seasonId, setSeasonId] =
    useState(
      defaultSeason?.id || ''
    )

  const [sportId, setSportId] =
    useState('')

  const sportTeams = useMemo(
    () =>
      teams
        .filter(
          team =>
            (!sportId ||
              team.sport_id ===
                sportId) &&
            team.active !== false &&
            isVarsityTeam(team)
        )
        .sort((a, b) =>
          (
            a.school?.school_name ||
            a.team_name
          ).localeCompare(
            b.school?.school_name ||
              b.team_name
          )
        ),
    [teams, sportId]
  )

  const filteredGames =
    useMemo(
      () =>
        games.filter(
          game =>
            game.season_id ===
              seasonId &&
            (!sportId ||
              game.sport_id ===
                sportId)
        ),
      [
        games,
        seasonId,
        sportId,
      ]
    )

  const filteredImports =
    useMemo(
      () =>
        importSources.filter(
          source =>
            source.season_id ===
              seasonId &&
            (!sportId ||
              source.sport_id ===
                sportId)
        ),
      [
        importSources,
        seasonId,
        sportId,
      ]
    )

  const sourcesByGame =
    useMemo(() => {
      const map = new Map<
        string,
        Set<string>
      >()

      for (const source of filteredImports) {
        if (
          !map.has(
            source.game_id
          )
        ) {
          map.set(
            source.game_id,
            new Set()
          )
        }

        map
          .get(source.game_id)!
          .add(source.team_id)
      }

      return map
    }, [filteredImports])

  const auditRows: TeamAudit[] =
    useMemo(() => {
      return sportTeams.map(
        team => {
          const teamGames =
            filteredGames.filter(
              game =>
                game.home_team_id ===
                  team.id ||
                game.away_team_id ===
                  team.id
            )

          const teamImports =
            filteredImports.filter(
              source =>
                source.team_id ===
                team.id
            )

          const imported =
            teamImports.length > 0

          let confirmedCount = 0
          let singleSourceCount = 0
          let issueCount = 0

          for (const game of teamGames) {
            const sourceTeams =
              sourcesByGame.get(
                game.id
              ) || new Set<string>()

            const bothInternal =
              !!game.home_team_id &&
              !!game.away_team_id

            const confirmed =
              bothInternal &&
              sourceTeams.has(
                game.home_team_id!
              ) &&
              sourceTeams.has(
                game.away_team_id!
              )

            if (confirmed) {
              confirmedCount++
            } else {
              singleSourceCount++
            }

            if (
              game.parser_confidence ===
                'Low' ||
              !game.game_date ||
              (!game.home_team_id &&
                !game.external_home_opponent_id) ||
              (!game.away_team_id &&
                !game.external_away_opponent_id)
            ) {
              issueCount++
            }
          }

          const lastImportedAt =
            teamImports.length > 0
              ? teamImports
                  .map(
                    source =>
                      source.imported_at
                  )
                  .sort()
                  .reverse()[0]
              : null

          return {
            team,
            gameCount:
              teamGames.length,
            scheduleImported:
              imported,
            confirmedCount,
            singleSourceCount,
            issueCount,
            lastImportedAt,
          }
        }
      )
    }, [
      sportTeams,
      filteredGames,
      filteredImports,
      sourcesByGame,
    ])

  const importedTeams =
    auditRows.filter(
      row =>
        row.scheduleImported
    ).length

  const notImportedTeams =
    auditRows.length -
    importedTeams

  const totalGames =
    filteredGames.length

  const confirmedGames =
    filteredGames.filter(
      game => {
        if (
          !game.home_team_id ||
          !game.away_team_id
        ) {
          return false
        }

        const sources =
          sourcesByGame.get(
            game.id
          )

        if (!sources) {
          return false
        }

        return (
          sources.has(
            game.home_team_id
          ) &&
          sources.has(
            game.away_team_id
          )
        )
      }
    ).length

  const singleSourceGames =
    totalGames -
    confirmedGames

  const dataIssues =
    filteredGames.filter(
      game =>
        game.parser_confidence ===
          'Low' ||
        (!game.home_team_id &&
          !game.external_home_opponent_id) ||
        (!game.away_team_id &&
          !game.external_away_opponent_id)
    ).length

  const importedGameCounts =
    auditRows
      .filter(
        row =>
          row.scheduleImported &&
          row.gameCount > 0
      )
      .map(
        row => row.gameCount
      )
      .sort(
        (a, b) => a - b
      )

  const medianGameCount =
    importedGameCounts.length ===
    0
      ? 0
      : importedGameCounts[
          Math.floor(
            importedGameCounts.length /
              2
          )
        ]

  const selectedSport =
    sports.find(
      sport =>
        sport.id === sportId
    )

  const selectedSeason =
    seasons.find(
      season =>
        season.id === seasonId
    )

  return (
    <div className="p-4 md:p-6 max-w-7xl">
      <div className="mb-5">
        <h1
          className="text-2xl font-bold"
          style={{
            fontFamily:
              'var(--font-display)',
          }}
        >
          Schedule Audit
        </h1>

        <p
          className="text-sm mt-1"
          style={{
            color:
              'var(--text-secondary)',
          }}
        >
          Track which team
          schedules have actually
          been imported, identify
          partial coverage, and
          confirm games from both
          sides.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div>
          <label className="label">
            Season
          </label>

          <select
            className="input"
            value={seasonId}
            onChange={event =>
              setSeasonId(
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

        <div>
          <label className="label">
            Sport
          </label>

          <select
            className="input"
            value={sportId}
            onChange={event =>
              setSportId(
                event.target.value
              )
            }
          >
            <option value="">
              Select a sport
            </option>

            {sports.map(
              sport => (
                <option
                  key={sport.id}
                  value={sport.id}
                >
                  {
                    sport.sport_name
                  }{' '}
                  ({sport.gender})
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {!sportId ? (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-2">
            📋
          </div>

          <div
            className="font-semibold"
            style={{
              color:
                'var(--text-primary)',
            }}
          >
            Select a sport to
            audit
          </div>

          <p
            className="text-sm mt-1"
            style={{
              color:
                'var(--text-muted)',
            }}
          >
            Choose a season and
            sport above to see
            schedule import
            progress.
          </p>
        </div>
      ) : (
        <>
          <div
            className="mb-4"
            style={{
              color:
                'var(--text-secondary)',
            }}
          >
            <span
              className="font-semibold"
              style={{
                color:
                  'var(--text-primary)',
              }}
            >
              {
                selectedSport?.sport_name
              }
            </span>

            {' · '}

            {
              selectedSeason?.name
            }
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <StatCard
              label="Teams"
              value={
                auditRows.length
              }
            />

            <StatCard
              label="Imported"
              value={
                importedTeams
              }
              good
            />

            <StatCard
              label="Not Imported"
              value={
                notImportedTeams
              }
              warning={
                notImportedTeams >
                0
              }
            />

            <StatCard
              label="Unique Games"
              value={
                totalGames
              }
            />

            <StatCard
              label="Confirmed Both"
              value={
                confirmedGames
              }
              good
            />

            <StatCard
              label="Single Source"
              value={
                singleSourceGames
              }
              warning={
                singleSourceGames >
                0
              }
            />

            <StatCard
              label="Data Issues"
              value={
                dataIssues
              }
              danger={
                dataIssues > 0
              }
            />
          </div>

          <div
            className="rounded-lg overflow-hidden"
            style={{
              border:
                '1px solid var(--border)',
              background:
                'var(--bg-card)',
            }}
          >
            <div
              className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-bold"
              style={{
                color:
                  'var(--text-muted)',
                borderBottom:
                  '1px solid var(--border)',
              }}
            >
              <div className="col-span-4">
                Team
              </div>

              <div className="col-span-2 text-center">
                Schedule
              </div>

              <div className="col-span-1 text-center">
                Games
              </div>

              <div className="col-span-2 text-center">
                Both Confirmed
              </div>

              <div className="col-span-2 text-center">
                Single Source
              </div>

              <div className="col-span-1 text-center">
                Issues
              </div>
            </div>

            {auditRows.map(
              row => {
                const suspiciousLowCount =
                  row.scheduleImported &&
                  medianGameCount >
                    0 &&
                  row.gameCount <
                    medianGameCount *
                      0.6

                return (
                  <div
                    key={
                      row.team.id
                    }
                    className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm"
                    style={{
                      borderBottom:
                        '1px solid var(--border)',
                    }}
                  >
                    <div className="col-span-4 min-w-0">
                      <div
                        className="font-semibold truncate"
                        style={{
                          color:
                            'var(--text-primary)',
                        }}
                      >
                        {row.team
                          .school
                          ?.school_name ||
                          row.team
                            .team_name}
                      </div>

                      <div
                        className="text-xs"
                        style={{
                          color:
                            'var(--text-muted)',
                        }}
                      >
                        {row.scheduleImported
                          ? row.lastImportedAt
                            ? `Imported ${new Date(
                                row.lastImportedAt
                              ).toLocaleDateString()}`
                            : 'Imported'
                          : row.gameCount >
                              0
                            ? `${row.gameCount} game${
                                row.gameCount ===
                                1
                                  ? ''
                                  : 's'
                              } already in database from opponents`
                            : 'No games loaded yet'}
                      </div>

                      {suspiciousLowCount && (
                        <div className="text-xs text-amber-400 mt-1">
                          ⚠ Game count
                          looks low
                          compared with
                          other imported
                          teams
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 text-center">
                      {row.scheduleImported ? (
                        <span className="confidence-high text-xs font-bold">
                          ✓ IMPORTED
                        </span>
                      ) : (
                        <span className="confidence-medium text-xs font-bold">
                          ○ NOT IMPORTED
                        </span>
                      )}
                    </div>

                    <div
                      className="col-span-1 text-center font-semibold"
                      style={{
                        color:
                          'var(--text-primary)',
                      }}
                    >
                      {
                        row.gameCount
                      }
                    </div>

                    <div className="col-span-2 text-center">
                      <span className="confidence-high">
                        {
                          row.confirmedCount
                        }
                      </span>
                    </div>

                    <div className="col-span-2 text-center">
                      <span
                        className={
                          row.singleSourceCount >
                          0
                            ? 'confidence-medium'
                            : ''
                        }
                        style={{
                          color:
                            row.singleSourceCount ===
                            0
                              ? 'var(--text-muted)'
                              : undefined,
                        }}
                      >
                        {
                          row.singleSourceCount
                        }
                      </span>
                    </div>

                    <div className="col-span-1 text-center">
                      <span
                        className={
                          row.issueCount >
                          0
                            ? 'confidence-low'
                            : 'confidence-high'
                        }
                      >
                        {
                          row.issueCount
                        }
                      </span>
                    </div>
                  </div>
                )
              }
            )}

            {auditRows.length ===
              0 && (
              <div
                className="p-8 text-center text-sm"
                style={{
                  color:
                    'var(--text-muted)',
                }}
              >
                No varsity teams
                found for this
                sport.
              </div>
            )}
          </div>

          <div
            className="mt-4 rounded-lg p-4 text-xs"
            style={{
              background:
                'rgba(59,130,246,0.06)',
              border:
                '1px solid rgba(59,130,246,0.15)',
              color:
                'var(--text-secondary)',
            }}
          >
            <strong
              style={{
                color:
                  'var(--text-primary)',
              }}
            >
              How to read this:
            </strong>{' '}
            “Imported” means that
            team's own Arbiter
            schedule has been
            published through the
            Import Center. A team
            can already have games
            in the database before
            its own schedule is
            imported because its
            opponents may have
            created those games
            first. “Both Confirmed”
            means the same game has
            appeared on both
            Section X teams'
            imported schedules.
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  good = false,
  warning = false,
  danger = false,
}: {
  label: string
  value: number
  good?: boolean
  warning?: boolean
  danger?: boolean
}) {
  let valueColor =
    'var(--text-primary)'

  if (good) {
    valueColor = '#4ade80'
  }

  if (warning) {
    valueColor = '#fbbf24'
  }

  if (danger) {
    valueColor = '#f87171'
  }

  return (
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
        className="text-xs mb-1"
        style={{
          color:
            'var(--text-muted)',
        }}
      >
        {label}
      </div>

      <div
        className="text-2xl font-bold"
        style={{
          fontFamily:
            'var(--font-display)',
          color: valueColor,
        }}
      >
        {value}
      </div>
    </div>
  )
}
