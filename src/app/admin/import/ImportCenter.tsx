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

type Tab =
  | 'paste'
  | 'csv'
  | 'arbiter'
  | 'school-sync'

interface ArbiterSchoolTeam {
  teamId: string
  entityId: string
  sportName: string | null
  teamLabel: string
  gender: 'Boys' | 'Girls' | 'Coed' | null
  level: string | null
  isVarsity: boolean
  displayName: string
  sectionXSportName: string | null
  seasonType: 'Fall' | 'Winter' | 'Spring' | null
  scheduleUrl: string
  success: boolean
  rowCount: number
  rows: Array<{
    dateTime: string
    homeAway: string
    opponent: string
    location: string
    results: string
    status: string
    type: string
    raw: string
  }>
  arbiterText: string
  error: string | null
}

interface ArbiterSchoolSyncResponse {
  success: boolean
  entityId: string
  schoolUrl: string
  discoveredTeams: number
  varsityTeams: number
  schedulesFetched: number
  schedulesFailed: number
  totalRows: number
  sports: string[]
  seasons: string[]
  teams: ArbiterSchoolTeam[]
  error?: string
}

interface PreparedSchedule {
  arbiterTeamId: string
  arbiterEntityId: string
  scheduleUrl: string
  displayName: string
  sectionXSportName: string | null
  seasonType: 'Fall' | 'Winter' | 'Spring' | null

  internalTeamId: string | null
  internalSportId: string | null
  internalSeasonId: string | null

  internalTeamName: string | null
  internalSportName: string | null
  internalSeasonName: string | null

  rows: ParsedGameRow[]

  selected: boolean
  ready: boolean
  mappingError: string | null
}

interface SchoolOption {
  slug: string
  school_name: string
  alias: string
  primary_color: string
}

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

  // SCHOOL SYNC STATE
  const [syncSchoolSlug, setSyncSchoolSlug] =
    useState('')

  const [syncSchoolUrl, setSyncSchoolUrl] =
    useState('')

  const [syncLoading, setSyncLoading] =
    useState(false)

  const [syncPublishing, setSyncPublishing] =
    useState(false)

  const [syncError, setSyncError] =
    useState<string | null>(null)

  const [syncRaw, setSyncRaw] =
    useState<ArbiterSchoolSyncResponse | null>(null)

  const [preparedSchedules, setPreparedSchedules] =
    useState<PreparedSchedule[]>([])

  const [syncDone, setSyncDone] =
    useState<{
      schedulesProcessed: number
      gamesProcessed: number
      skipped: number
      errors: string[]
      trackingErrors: string[]
    } | null>(null)

  const schools = useMemo<SchoolOption[]>(() => {
    const map = new Map<string, SchoolOption>()

    for (const team of teams) {
      if (!team.school?.slug) continue

      if (!map.has(team.school.slug)) {
        map.set(team.school.slug, {
          slug: team.school.slug,
          school_name: team.school.school_name,
          alias: team.school.alias,
          primary_color: team.school.primary_color,
        })
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.school_name.localeCompare(b.school_name)
    )
  }, [teams])

  const selectedSyncSchool = useMemo(
    () =>
      schools.find(
        school => school.slug === syncSchoolSlug
      ) || null,
    [schools, syncSchoolSlug]
  )

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

  const selectedSyncYear =
    selectedSeason?.year ||
    new Date().getFullYear()

  function normalizedSportName(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function findInternalSport(
    sectionXSportName: string | null,
    arbiterSportName: string | null,
    gender: 'Boys' | 'Girls' | 'Coed' | null
  ): Sport | null {
    if (!sectionXSportName && !arbiterSportName) {
      return null
    }

    const candidates = [
      sectionXSportName,
      arbiterSportName,
      gender && arbiterSportName
        ? `${gender} ${arbiterSportName}`
        : null,
    ].filter(Boolean) as string[]

    for (const candidate of candidates) {
      const normalizedCandidate =
        normalizedSportName(candidate)

      const exact = sports.find(
        sport =>
          normalizedSportName(sport.sport_name) ===
          normalizedCandidate
      )

      if (exact) return exact
    }

    // Common Arbiter -> Section X naming fallbacks.
    if (arbiterSportName) {
      const base = normalizedSportName(
        arbiterSportName
      )

      if (
        base === 'soccer' &&
        (gender === 'Boys' || gender === 'Girls')
      ) {
        return (
          sports.find(
            sport =>
              normalizedSportName(sport.sport_name) ===
              normalizedSportName(`${gender} Soccer`)
          ) || null
        )
      }

      if (
        base === 'basketball' &&
        (gender === 'Boys' || gender === 'Girls')
      ) {
        return (
          sports.find(
            sport =>
              normalizedSportName(sport.sport_name) ===
              normalizedSportName(`${gender} Basketball`)
          ) || null
        )
      }

      if (
        base === 'lacrosse' &&
        (gender === 'Boys' || gender === 'Girls')
      ) {
        return (
          sports.find(
            sport =>
              normalizedSportName(sport.sport_name) ===
              normalizedSportName(`${gender} Lacrosse`)
          ) || null
        )
      }
    }

    return null
  }

  function findInternalSeason(
    seasonType:
      | 'Fall'
      | 'Winter'
      | 'Spring'
      | null
  ): Season | null {
    if (!seasonType) return null

    const sameYear = seasons.find(
      season =>
        season.season_type === seasonType &&
        season.year === selectedSyncYear
    )

    if (sameYear) return sameYear

    return (
      seasons.find(
        season =>
          season.season_type === seasonType
      ) || null
    )
  }

  function buildTeamRecordsForSport(
    sportId: string
  ) {
    return teams
      .filter(
        team => team.sport_id === sportId
      )
      .map(team => ({
        id: team.id,
        team_name: team.team_name,
        school_name:
          team.school?.school_name || '',
        slug:
          team.school?.slug || '',
        aliases:
          team.school?.alias
            ? [team.school.alias]
            : [],
      }))
  }

  function prepareSchoolSchedules(
    response: ArbiterSchoolSyncResponse
  ): PreparedSchedule[] {
    if (!selectedSyncSchool) return []

    return response.teams
      .filter(
        team =>
          team.isVarsity &&
          team.success
      )
      .map(team => {
        const internalSport =
          findInternalSport(
            team.sectionXSportName,
            team.sportName,
            team.gender
          )

        const internalSeason =
          findInternalSeason(
            team.seasonType
          )

        const internalTeam =
          internalSport
            ? teams.find(
                candidate =>
                  candidate.sport_id ===
                    internalSport.id &&
                  candidate.school?.slug ===
                    selectedSyncSchool.slug
              ) || null
            : null

        let mappingError: string | null = null

        if (!internalSport) {
          mappingError =
            `Could not match sport "${team.sectionXSportName || team.sportName || 'Unknown'}" to Section X.`
        } else if (!internalSeason) {
          mappingError =
            `Could not find a ${team.seasonType || 'matching'} ${selectedSyncYear} season.`
        } else if (!internalTeam) {
          mappingError =
            `No ${internalSport.sport_name} team exists for ${selectedSyncSchool.school_name}.`
        }

        if (
          !internalSport ||
          !internalSeason ||
          !internalTeam
        ) {
          return {
            arbiterTeamId:
              team.teamId,
            arbiterEntityId:
              team.entityId,
            scheduleUrl:
              team.scheduleUrl,
            displayName:
              team.displayName,
            sectionXSportName:
              team.sectionXSportName,
            seasonType:
              team.seasonType,

            internalTeamId: null,
            internalSportId:
              internalSport?.id || null,
            internalSeasonId:
              internalSeason?.id || null,

            internalTeamName:
              internalTeam?.team_name || null,
            internalSportName:
              internalSport?.sport_name || null,
            internalSeasonName:
              internalSeason?.name || null,

            rows: [],

            selected: false,
            ready: false,
            mappingError,
          }
        }

        const sportTeamRecords =
          buildTeamRecordsForSport(
            internalSport.id
          )

        let rows =
          parseArbiterSchedule(
            team.arbiterText,
            {
              teams: sportTeamRecords,
              sourceTeamId:
                internalTeam.id,
              defaultDate,
              defaultSportId:
                internalSport.id,
              defaultSeasonId:
                internalSeason.id,
              year:
                internalSeason.year ||
                selectedSyncYear,
            }
          )

        /*
          School Sync keeps canceled/postponed rows in the
          parsed data. They are useful for schedule history
          and future change detection. Low-confidence rows
          are never auto-selected.
        */
        rows = rows.map(row => ({
          ...row,
          approved:
            row.confidence === 'High',
        }))

        return {
          arbiterTeamId:
            team.teamId,
          arbiterEntityId:
            team.entityId,
          scheduleUrl:
            team.scheduleUrl,
          displayName:
            team.displayName,
          sectionXSportName:
            team.sectionXSportName,
          seasonType:
            team.seasonType,

          internalTeamId:
            internalTeam.id,
          internalSportId:
            internalSport.id,
          internalSeasonId:
            internalSeason.id,

          internalTeamName:
            internalTeam.team_name,
          internalSportName:
            internalSport.sport_name,
          internalSeasonName:
            internalSeason.name,

          rows,

          selected: true,
          ready: true,
          mappingError: null,
        }
      })
  }

  const handleSchoolSyncFetch = async () => {
    if (
      !syncSchoolUrl.trim() ||
      !syncSchoolSlug
    ) {
      return
    }

    setSyncLoading(true)
    setSyncError(null)
    setSyncRaw(null)
    setPreparedSchedules([])
    setSyncDone(null)

    try {
      const response = await fetch(
        '/api/admin/arbiter-school-sync',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            url: syncSchoolUrl.trim(),
          }),
        }
      )

      const result =
        (await response.json()) as
          ArbiterSchoolSyncResponse

      if (!response.ok || !result.success) {
        setSyncError(
          result.error ||
            `Server error ${response.status}`
        )
        return
      }

      setSyncRaw(result)

      const prepared =
        prepareSchoolSchedules(result)

      setPreparedSchedules(
        prepared
      )
    } catch (error: any) {
      setSyncError(
        error?.message ||
          'Could not fetch Arbiter school schedules.'
      )
    } finally {
      setSyncLoading(false)
    }
  }

  const toggleScheduleSelected = (
    arbiterTeamId: string
  ) => {
    setPreparedSchedules(previous =>
      previous.map(schedule =>
        schedule.arbiterTeamId ===
        arbiterTeamId &&
        schedule.ready
          ? {
              ...schedule,
              selected:
                !schedule.selected,
            }
          : schedule
      )
    )
  }

  const toggleSyncRowApprove = (
    arbiterTeamId: string,
    rowId: string
  ) => {
    setPreparedSchedules(previous =>
      previous.map(schedule => {
        if (
          schedule.arbiterTeamId !==
          arbiterTeamId
        ) {
          return schedule
        }

        return {
          ...schedule,
          rows: schedule.rows.map(row =>
            row.id === rowId &&
            row.confidence !== 'Low'
              ? {
                  ...row,
                  approved:
                    !row.approved,
                }
              : row
          ),
        }
      })
    )
  }

  const approveHighForSchedule = (
    arbiterTeamId: string
  ) => {
    setPreparedSchedules(previous =>
      previous.map(schedule => {
        if (
          schedule.arbiterTeamId !==
          arbiterTeamId
        ) {
          return schedule
        }

        return {
          ...schedule,
          rows: schedule.rows.map(row => ({
            ...row,
            approved:
              row.confidence === 'High',
          })),
        }
      })
    )
  }

  const selectAllReadySchedules = () => {
    setPreparedSchedules(previous =>
      previous.map(schedule => ({
        ...schedule,
        selected:
          schedule.ready,
      }))
    )
  }

  const deselectAllSchedules = () => {
    setPreparedSchedules(previous =>
      previous.map(schedule => ({
        ...schedule,
        selected: false,
      }))
    )
  }

  const schoolSyncSelectedSchedules =
    preparedSchedules.filter(
      schedule =>
        schedule.selected &&
        schedule.ready
    )

  const schoolSyncApprovedRows =
    schoolSyncSelectedSchedules.reduce(
      (total, schedule) =>
        total +
        schedule.rows.filter(
          row => row.approved
        ).length,
      0
    )

  const handleSchoolSyncPublish =
    async () => {
      const schedules =
        preparedSchedules.filter(
          schedule =>
            schedule.selected &&
            schedule.ready &&
            schedule.internalTeamId &&
            schedule.internalSportId &&
            schedule.internalSeasonId
        )

      if (schedules.length === 0) {
        return
      }

      setSyncPublishing(true)
      setSyncError(null)

      let schedulesProcessed = 0
      let gamesProcessed = 0
      let skipped = 0
      const errors: string[] = []
      const trackingErrors: string[] = []

      try {
        /*
          Publish each Arbiter team schedule separately.
          This preserves source-team confirmation tracking,
          which is what allows Schedule Audit to confirm
          the same game from both schools.
        */
        for (const schedule of schedules) {
          const approvedRows =
            schedule.rows.filter(
              row => row.approved
            )

          if (approvedRows.length === 0) {
            continue
          }

          const games =
            approvedRows
              .filter(
                row => row.game_date
              )
              .map(row => ({
                season_id:
                  schedule.internalSeasonId,

                sport_id:
                  row.sport_id ||
                  schedule.internalSportId,

                game_date:
                  row.game_date,

                game_time:
                  row.game_time,

                location:
                  row.location || null,

                home_team_id:
                  row.home_team_id ||
                  null,

                away_team_id:
                  row.away_team_id ||
                  null,

                external_home_name:
                  row.external_home_name ||
                  null,

                external_away_name:
                  row.external_away_name ||
                  null,

                home_score:
                  row.home_score,

                away_score:
                  row.away_score,

                status:
                  row.status,

                rescheduled_date:
                  row.rescheduled_date,

                game_number:
                  row.game_number,

                neutral_site:
                  row.neutral_site,

                event_name:
                  row.event_name,

                notes:
                  row.notes || null,

                parser_confidence:
                  row.confidence,

                source:
                  'arbiter',

                verification_status:
                  'Reported',
              }))

          if (games.length === 0) {
            continue
          }

          const response =
            await fetch(
              '/api/admin/games',
              {
                method: 'POST',
                credentials:
                  'include',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  games,
                  import_team_id:
                    schedule.internalTeamId,
                  import_source:
                    'arbiter',
                }),
              }
            )

          const result =
            await response.json()

          if (!response.ok) {
            errors.push(
              `${schedule.displayName}: ${
                result.error ||
                `Server error ${response.status}`
              }`
            )

            skipped +=
              games.length

            continue
          }

          schedulesProcessed += 1

          gamesProcessed +=
            result.published || 0

          skipped +=
            result.skipped || 0

          if (
            Array.isArray(
              result.errors
            )
          ) {
            for (
              const error of
              result.errors
            ) {
              errors.push(
                `${schedule.displayName}: ${error}`
              )
            }
          }

          if (
            Array.isArray(
              result.tracking_errors
            )
          ) {
            for (
              const error of
              result.tracking_errors
            ) {
              trackingErrors.push(
                `${schedule.displayName}: ${error}`
              )
            }
          }
        }

        setSyncDone({
          schedulesProcessed,
          gamesProcessed,
          skipped,
          errors,
          trackingErrors,
        })
      } catch (error: any) {
        setSyncError(
          error?.message ||
            'School Sync publish failed.'
        )
      } finally {
        setSyncPublishing(false)
      }
    }

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

  const resetSchoolSync = () => {
    setSyncRaw(null)
    setPreparedSchedules([])
    setSyncDone(null)
    setSyncError(null)
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
    <div className="p-4 max-w-6xl">
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
        Paste scores, import a single Arbiter schedule,
        or sync every published varsity schedule from one
        ArbiterLive school page.
      </p>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-5 border-b flex-wrap"
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
            {
              id: 'school-sync',
              label: 'Arbiter School Sync',
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

              if (
                item.id !==
                'school-sync'
              ) {
                setSyncError(null)
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* SCHOOL SYNC */}
      {tab === 'school-sync' ? (
        <div className="space-y-4">
          <div
            className="rounded-xl p-4"
            style={{
              background:
                'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(59,130,246,0.04))',
              border:
                '1px solid rgba(59,130,246,0.22)',
            }}
          >
            <div
              className="font-bold text-lg"
              style={{
                fontFamily:
                  'var(--font-display)',
                color:
                  'var(--text-primary)',
              }}
            >
              Arbiter School Sync
            </div>

            <p
              className="text-sm mt-1"
              style={{
                color:
                  'var(--text-secondary)',
              }}
            >
              Pick the Section X school, paste one public
              ArbiterLive school URL, and Section X Scoreboard
              will discover every published varsity team,
              fetch all schedules, map sport/season/team, parse
              every game, and preserve source confirmations.
            </p>
          </div>

          {!syncRaw && !syncDone && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">
                    Section X School
                    <span className="text-red-400 text-xs font-bold">
                      {' '}* Required
                    </span>
                  </label>

                  <select
                    className="input"
                    value={
                      syncSchoolSlug
                    }
                    onChange={event => {
                      setSyncSchoolSlug(
                        event.target.value
                      )
                      resetSchoolSync()
                    }}
                  >
                    <option value="">
                      Select school
                    </option>

                    {schools.map(
                      school => (
                        <option
                          key={
                            school.slug
                          }
                          value={
                            school.slug
                          }
                        >
                          {
                            school.school_name
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="label">
                    School Sync Year
                  </label>

                  <select
                    className="input"
                    value={
                      defaultSeasonId
                    }
                    onChange={event => {
                      setDefaultSeasonId(
                        event.target.value
                      )
                      resetSchoolSync()
                    }}
                  >
                    {seasons.map(
                      season => (
                        <option
                          key={
                            season.id
                          }
                          value={
                            season.id
                          }
                        >
                          {
                            season.name
                          }
                        </option>
                      )
                    )}
                  </select>

                  <p
                    className="text-xs mt-1"
                    style={{
                      color:
                        'var(--text-muted)',
                    }}
                  >
                    Used to match Fall, Winter, and Spring
                    schedules to {selectedSyncYear}.
                  </p>
                </div>
              </div>

              <div>
                <label className="label">
                  ArbiterLive School URL
                  <span className="text-red-400 text-xs font-bold">
                    {' '}* Required
                  </span>
                </label>

                <input
                  className="input font-mono text-sm"
                  value={
                    syncSchoolUrl
                  }
                  onChange={event =>
                    setSyncSchoolUrl(
                      event.target.value
                    )
                  }
                  placeholder="https://arbiterlive.com/Teams?entityId=9954"
                />

                <p
                  className="text-xs mt-1"
                  style={{
                    color:
                      'var(--text-muted)',
                  }}
                >
                  One school page is enough. The sync engine
                  discovers its published varsity sports and
                  fetches every schedule automatically.
                </p>
              </div>

              <button
                className="btn-primary"
                onClick={
                  handleSchoolSyncFetch
                }
                disabled={
                  syncLoading ||
                  !syncSchoolSlug ||
                  !syncSchoolUrl.trim()
                }
              >
                {syncLoading
                  ? 'Discovering & Fetching...'
                  : 'Discover & Fetch All Varsity Schedules'}
              </button>
            </>
          )}

          {syncError && (
            <div
              className="rounded-lg p-3 text-sm"
              style={{
                background:
                  'rgba(239,68,68,0.08)',
                border:
                  '1px solid rgba(239,68,68,0.25)',
                color:
                  '#f87171',
              }}
            >
              {syncError}
            </div>
          )}

          {syncRaw &&
            !syncDone && (
              <>
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
                >
                  {[
                    [
                      'School',
                      selectedSyncSchool?.school_name ||
                        'Selected',
                    ],
                    [
                      'Entity',
                      syncRaw.entityId,
                    ],
                    [
                      'Varsity Teams',
                      String(
                        syncRaw.varsityTeams
                      ),
                    ],
                    [
                      'Fetched',
                      String(
                        syncRaw.schedulesFetched
                      ),
                    ],
                    [
                      'Rows',
                      String(
                        syncRaw.totalRows
                      ),
                    ],
                    [
                      'Failed',
                      String(
                        syncRaw.schedulesFailed
                      ),
                    ],
                  ].map(
                    ([label, value]) => (
                      <div
                        key={label}
                        className="card p-3"
                      >
                        <div
                          className="text-xs"
                          style={{
                            color:
                              'var(--text-muted)',
                          }}
                        >
                          {label}
                        </div>

                        <div
                          className="font-bold mt-1"
                          style={{
                            color:
                              'var(--text-primary)',
                            fontFamily:
                              'var(--font-display)',
                          }}
                        >
                          {value}
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    className="btn-ghost text-xs"
                    onClick={
                      selectAllReadySchedules
                    }
                  >
                    Select All Ready
                  </button>

                  <button
                    className="btn-ghost text-xs"
                    onClick={
                      deselectAllSchedules
                    }
                  >
                    Deselect All
                  </button>

                  <div className="flex-1" />

                  <button
                    className="btn-ghost"
                    onClick={
                      resetSchoolSync
                    }
                  >
                    Start Over
                  </button>

                  <button
                    className="btn-primary"
                    onClick={
                      handleSchoolSyncPublish
                    }
                    disabled={
                      syncPublishing ||
                      schoolSyncSelectedSchedules.length ===
                        0 ||
                      schoolSyncApprovedRows ===
                        0
                    }
                  >
                    {syncPublishing
                      ? 'Publishing School Schedules...'
                      : `Publish ${schoolSyncApprovedRows} High-Confidence Games`}
                  </button>
                </div>

                <div
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background:
                      'rgba(34,197,94,0.06)',
                    border:
                      '1px solid rgba(34,197,94,0.18)',
                    color:
                      'var(--text-secondary)',
                  }}
                >
                  High-confidence games are selected
                  automatically. Low-confidence tournament,
                  multi-team, or malformed rows stay out unless
                  fixed later. Each schedule is published
                  separately so Schedule Audit can confirm the
                  same game from both schools.
                </div>

                <div className="space-y-3">
                  {preparedSchedules.map(
                    schedule => {
                      const high =
                        schedule.rows.filter(
                          row =>
                            row.confidence ===
                            'High'
                        ).length

                      const medium =
                        schedule.rows.filter(
                          row =>
                            row.confidence ===
                            'Medium'
                        ).length

                      const low =
                        schedule.rows.filter(
                          row =>
                            row.confidence ===
                            'Low'
                        ).length

                      const approved =
                        schedule.rows.filter(
                          row =>
                            row.approved
                        ).length

                      return (
                        <div
                          key={
                            schedule.arbiterTeamId
                          }
                          className="rounded-xl overflow-hidden"
                          style={{
                            background:
                              'var(--bg-card)',
                            border:
                              schedule.ready
                                ? '1px solid var(--border)'
                                : '1px solid rgba(239,68,68,0.28)',
                          }}
                        >
                          <div className="p-4 flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={
                                schedule.selected
                              }
                              disabled={
                                !schedule.ready
                              }
                              onChange={() =>
                                toggleScheduleSelected(
                                  schedule.arbiterTeamId
                                )
                              }
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                  <div
                                    className="font-bold text-base"
                                    style={{
                                      fontFamily:
                                        'var(--font-display)',
                                      color:
                                        'var(--text-primary)',
                                    }}
                                  >
                                    {
                                      schedule.displayName
                                    }
                                  </div>

                                  <div
                                    className="text-xs mt-1"
                                    style={{
                                      color:
                                        'var(--text-secondary)',
                                    }}
                                  >
                                    {schedule.internalSportName ||
                                      schedule.sectionXSportName ||
                                      'Unknown sport'}
                                    {' · '}
                                    {schedule.internalSeasonName ||
                                      schedule.seasonType ||
                                      'Unknown season'}
                                    {' · '}
                                    Arbiter Team{' '}
                                    {
                                      schedule.arbiterTeamId
                                    }
                                  </div>
                                </div>

                                {schedule.ready ? (
                                  <div className="flex items-center gap-2 text-xs flex-wrap">
                                    <span className="confidence-high">
                                      ✓ {high} high
                                    </span>

                                    <span className="confidence-medium">
                                      ~ {medium} medium
                                    </span>

                                    <span className="confidence-low">
                                      ⚠ {low} low
                                    </span>

                                    <span
                                      className="font-bold"
                                      style={{
                                        color:
                                          'var(--text-primary)',
                                      }}
                                    >
                                      {approved} selected
                                    </span>
                                  </div>
                                ) : (
                                  <span className="confidence-low text-xs">
                                    Mapping required
                                  </span>
                                )}
                              </div>

                              {schedule.mappingError && (
                                <div
                                  className="mt-2 text-xs"
                                  style={{
                                    color:
                                      '#f87171',
                                  }}
                                >
                                  ⚠{' '}
                                  {
                                    schedule.mappingError
                                  }
                                </div>
                              )}

                              {schedule.ready && (
                                <>
                                  <div
                                    className="mt-3 text-xs"
                                    style={{
                                      color:
                                        'var(--text-muted)',
                                    }}
                                  >
                                    Source:{' '}
                                    {selectedSyncSchool?.school_name}
                                    {' → '}
                                    {schedule.internalTeamName}
                                  </div>

                                  <div className="mt-3 flex items-center gap-2">
                                    <button
                                      className="btn-ghost text-xs py-1 px-2"
                                      onClick={() =>
                                        approveHighForSchedule(
                                          schedule.arbiterTeamId
                                        )
                                      }
                                    >
                                      Reset to High Confidence
                                    </button>
                                  </div>

                                  <details className="mt-3">
                                    <summary
                                      className="cursor-pointer text-xs font-bold"
                                      style={{
                                        color:
                                          'var(--accent-bright)',
                                      }}
                                    >
                                      Review {schedule.rows.length} parsed rows
                                    </summary>

                                    <div className="mt-3 space-y-2">
                                      {schedule.rows.map(
                                        row => (
                                          <div
                                            key={
                                              row.id
                                            }
                                            className="rounded-lg p-3"
                                            style={{
                                              background:
                                                row.approved
                                                  ? 'rgba(34,197,94,0.05)'
                                                  : 'rgba(0,0,0,0.12)',
                                              border: `1px solid ${
                                                row.approved
                                                  ? 'rgba(34,197,94,0.18)'
                                                  : row.confidence ===
                                                      'Low'
                                                    ? 'rgba(239,68,68,0.24)'
                                                    : 'var(--border)'
                                              }`,
                                            }}
                                          >
                                            <div className="flex items-start gap-3">
                                              <input
                                                type="checkbox"
                                                className="mt-1"
                                                checked={
                                                  row.approved
                                                }
                                                disabled={
                                                  row.confidence ===
                                                  'Low'
                                                }
                                                onChange={() =>
                                                  toggleSyncRowApprove(
                                                    schedule.arbiterTeamId,
                                                    row.id
                                                  )
                                                }
                                              />

                                              <div className="flex-1 min-w-0">
                                                <div
                                                  className="text-xs font-mono mb-2"
                                                  style={{
                                                    color:
                                                      'var(--text-muted)',
                                                  }}
                                                >
                                                  {row.raw}
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
                                                  <div>
                                                    <div className="section-label mb-0.5">
                                                      Away
                                                    </div>
                                                    <div>
                                                      {row.away_team_match ||
                                                        row.away_team_name ||
                                                        '—'}
                                                    </div>
                                                  </div>

                                                  <div>
                                                    <div className="section-label mb-0.5">
                                                      Home
                                                    </div>
                                                    <div>
                                                      {row.home_team_match ||
                                                        row.home_team_name ||
                                                        '—'}
                                                    </div>
                                                  </div>

                                                  <div>
                                                    <div className="section-label mb-0.5">
                                                      Date
                                                    </div>
                                                    <div>
                                                      {row.game_date ||
                                                        '—'}
                                                    </div>
                                                  </div>

                                                  <div>
                                                    <div className="section-label mb-0.5">
                                                      Confidence
                                                    </div>
                                                    <div
                                                      className={
                                                        row.confidence ===
                                                        'High'
                                                          ? 'confidence-high'
                                                          : row.confidence ===
                                                              'Medium'
                                                            ? 'confidence-medium'
                                                            : 'confidence-low'
                                                      }
                                                    >
                                                      {
                                                        row.confidence
                                                      }
                                                    </div>
                                                  </div>
                                                </div>

                                                {row.confidence_notes.length >
                                                  0 && (
                                                  <div
                                                    className="text-xs mt-2"
                                                    style={{
                                                      color:
                                                        'var(--text-secondary)',
                                                    }}
                                                  >
                                                    {row.confidence_notes.join(
                                                      ' · '
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </details>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              </>
            )}

          {syncDone && (
            <div className="card p-8 text-center">
              <div className="text-5xl mb-3">
                ✅
              </div>

              <h2
                className="text-xl font-bold"
                style={{
                  fontFamily:
                    'var(--font-display)',
                }}
              >
                School Sync Complete
              </h2>

              <p
                className="mt-2"
                style={{
                  color:
                    'var(--text-secondary)',
                }}
              >
                {syncDone.schedulesProcessed}{' '}
                schedules processed ·{' '}
                {syncDone.gamesProcessed}{' '}
                games processed
                {syncDone.skipped > 0
                  ? ` · ${syncDone.skipped} skipped`
                  : ''}
              </p>

              {syncDone.errors.map(
                (error, index) => (
                  <p
                    key={`sync-error-${index}`}
                    className="text-xs mt-2"
                    style={{
                      color:
                        '#f87171',
                    }}
                  >
                    {error}
                  </p>
                )
              )}

              {syncDone.trackingErrors.map(
                (error, index) => (
                  <p
                    key={`sync-track-${index}`}
                    className="text-xs mt-2"
                    style={{
                      color:
                        '#fbbf24',
                    }}
                  >
                    Tracking warning:{' '}
                    {error}
                  </p>
                )
              )}

              <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
                <button
                  className="btn-primary"
                  onClick={() => {
                    resetSchoolSync()
                    setSyncSchoolUrl('')
                  }}
                >
                  Sync Another School
                </button>

                <a
                  href="/admin/schedule-audit"
                  className="btn-ghost"
                >
                  Open Schedule Audit
                </a>
              </div>
            </div>
          )}
        </div>
      ) : step === 'done' ? (
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
