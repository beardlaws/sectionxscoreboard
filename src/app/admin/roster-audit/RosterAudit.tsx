// src/app/admin/roster-audit/RosterAudit.tsx
'use client'

import { useMemo, useState } from 'react'

interface School {
  id: string
  school_name: string
  slug: string
  alias: string | null
  active: boolean
  arbiter_entity_id: string | null
  arbiter_school_url: string | null
}

interface Team {
  id: string
  school_id: string
  sport_id: string
  team_name: string
  slug: string
  level: string | null
  active: boolean
}

interface Sport {
  id: string
  sport_name: string
  gender: string | null
  season_type: string | null
  slug: string
}

interface Season {
  id: string
  name: string
  season_type: string
  year: number
  is_active: boolean
}

interface TeamSeason {
  id: string
  team_id: string
  season_id: string
  active_for_season: boolean | null
  division: string | null
  class: string | null
}

interface RosterEntry {
  id: string
  team_id: string
  season_id: string
  athlete_id: string
  active: boolean
  imported_at: string | null
  source: string | null
}

interface CoachEntry {
  id: string
  team_id: string
  season_id: string
  coach_id: string
  active: boolean
  imported_at: string | null
  source: string | null
}

interface Props {
  schools: School[]
  teams: Team[]
  sports: Sport[]
  seasons: Season[]
  teamSeasons: TeamSeason[]
  rosterEntries: RosterEntry[]
  coachEntries: CoachEntry[]
}

interface ArbiterTeam {
  teamId: string
  sectionXSportName: string | null
  seasonType: 'Fall' | 'Winter' | 'Spring' | null
  scheduleUrl: string
  rosterFound: boolean
  roster: Array<{
    jerseyNumber: string
    displayName: string
    firstName: string
    lastName: string
    classYear: string
    position: string
    height: string
  }>
  coachesFound: boolean
  coaches: Array<{
    displayName: string
    firstName: string
    lastName: string
    title: string
  }>
}

interface ArbiterResponse {
  success: boolean
  teams: ArbiterTeam[]
  error?: string
}

function displaySportName(sport: Sport) {
  const name = sport.sport_name || ''
  const gender = sport.gender || ''

  if (
    (gender === 'Boys' || gender === 'Girls') &&
    !name.toLowerCase().startsWith(gender.toLowerCase())
  ) {
    return `${gender} ${name}`
  }

  return name
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function latestDate(values: Array<string | null>) {
  const clean = values.filter(Boolean) as string[]
  if (clean.length === 0) return null
  return clean.sort().at(-1) || null
}

export default function RosterAudit({
  schools,
  teams,
  sports,
  seasons,
  teamSeasons,
  rosterEntries,
  coachEntries,
}: Props) {
  const activeSeason =
    seasons.find(season => season.is_active) ||
    seasons[0]

  const [sportFilter, setSportFilter] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState('')
  const [syncErrors, setSyncErrors] = useState<string[]>([])
  const [completedSchools, setCompletedSchools] = useState(0)

  const activeRows = useMemo(() => {
    if (!activeSeason) return []

    return teamSeasons
      .filter(
        ts =>
          ts.season_id === activeSeason.id &&
          ts.active_for_season !== false
      )
      .map(ts => {
        const team = teams.find(item => item.id === ts.team_id)
        if (!team) return null
        if (team.active === false) return null
        if (
          team.level &&
          team.level.toLowerCase().trim() !== 'varsity'
        ) {
          return null
        }

        const school = schools.find(item => item.id === team.school_id)
        const sport = sports.find(item => item.id === team.sport_id)

        if (!school || !sport) return null

        const roster = rosterEntries.filter(
          entry =>
            entry.team_id === team.id &&
            entry.season_id === activeSeason.id &&
            entry.active
        )

        const coaches = coachEntries.filter(
          entry =>
            entry.team_id === team.id &&
            entry.season_id === activeSeason.id &&
            entry.active
        )

        return {
          teamSeason: ts,
          team,
          school,
          sport,
          rosterCount: roster.length,
          coachCount: coaches.length,
          lastImported: latestDate([
            ...roster.map(entry => entry.imported_at),
            ...coaches.map(entry => entry.imported_at),
          ]),
        }
      })
      .filter(Boolean) as Array<{
        teamSeason: TeamSeason
        team: Team
        school: School
        sport: Sport
        rosterCount: number
        coachCount: number
        lastImported: string | null
      }>
  }, [
    activeSeason,
    teamSeasons,
    teams,
    schools,
    sports,
    rosterEntries,
    coachEntries,
  ])

  const filteredRows = useMemo(
    () =>
      activeRows
        .filter(row => !sportFilter || row.sport.id === sportFilter)
        .sort((a, b) => {
          const sportCompare = displaySportName(a.sport).localeCompare(
            displaySportName(b.sport)
          )
          if (sportCompare !== 0) return sportCompare
          return a.school.school_name.localeCompare(b.school.school_name)
        }),
    [activeRows, sportFilter]
  )

  const rosterLoaded = activeRows.filter(row => row.rosterCount > 0).length
  const missingRoster = activeRows.filter(row => row.rosterCount === 0).length
  const athletes = activeRows.reduce((sum, row) => sum + row.rosterCount, 0)
  const coaches = activeRows.reduce((sum, row) => sum + row.coachCount, 0)
  const linkedSchools = schools.filter(school => school.arbiter_school_url)

  function findInternalSport(sectionXSportName: string | null) {
    if (!sectionXSportName) return null
    const wanted = normalize(sectionXSportName)

    return (
      sports.find(sport => normalize(displaySportName(sport)) === wanted) ||
      sports.find(sport => normalize(sport.sport_name) === wanted) ||
      null
    )
  }

  async function syncSchools(onlyMissing: boolean) {
    if (!activeSeason) return

    const missingSchoolIds = new Set(
      activeRows
        .filter(row => row.rosterCount === 0)
        .map(row => row.school.id)
    )

    const targets = linkedSchools.filter(
      school => !onlyMissing || missingSchoolIds.has(school.id)
    )

    if (targets.length === 0) {
      setSyncErrors([
        onlyMissing
          ? 'No linked schools currently need a roster sync.'
          : 'No schools have Arbiter URLs saved.',
      ])
      return
    }

    setSyncing(true)
    setSyncErrors([])
    setCompletedSchools(0)

    const errors: string[] = []

    for (let index = 0; index < targets.length; index++) {
      const school = targets[index]
      setProgress(
        `${index + 1}/${targets.length} · Checking ${school.school_name}`
      )

      try {
        const discoveryResponse = await fetch(
          '/api/admin/arbiter-school-sync',
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: school.arbiter_school_url,
            }),
          }
        )

        const discovery: ArbiterResponse =
          await discoveryResponse.json()

        if (!discoveryResponse.ok || !discovery.success) {
          throw new Error(
            discovery.error ||
              `Discovery failed with ${discoveryResponse.status}`
          )
        }

        const payload = discovery.teams
          .filter(
            arbiterTeam =>
              arbiterTeam.seasonType === activeSeason.season_type &&
              (arbiterTeam.rosterFound || arbiterTeam.coachesFound)
          )
          .map(arbiterTeam => {
            const sport = findInternalSport(
              arbiterTeam.sectionXSportName
            )

            if (!sport) return null

            const team = teams.find(
              item =>
                item.school_id === school.id &&
                item.sport_id === sport.id &&
                item.active !== false &&
                (!item.level ||
                  item.level.toLowerCase().trim() === 'varsity')
            )

            if (!team) return null

            return {
              team_id: team.id,
              season_id: activeSeason.id,
              source_url: arbiterTeam.scheduleUrl,
              roster_found: arbiterTeam.rosterFound,
              coaches_found: arbiterTeam.coachesFound,
              roster: arbiterTeam.roster,
              coaches: arbiterTeam.coaches,
            }
          })
          .filter(Boolean)

        if (payload.length > 0) {
          const publishResponse = await fetch(
            '/api/admin/arbiter-rosters',
            {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                teams: payload,
              }),
            }
          )

          const publishResult = await publishResponse.json()

          if (!publishResponse.ok) {
            throw new Error(
              publishResult.error ||
                `Roster publish failed with ${publishResponse.status}`
            )
          }

          if (Array.isArray(publishResult.errors)) {
            for (const error of publishResult.errors) {
              errors.push(`${school.school_name}: ${error}`)
            }
          }
        }

        setCompletedSchools(index + 1)
      } catch (error: any) {
        errors.push(
          `${school.school_name}: ${error?.message || 'Sync failed'}`
        )
      }
    }

    setProgress(
      `Finished ${targets.length} school${targets.length === 1 ? '' : 's'}`
    )
    setSyncErrors(errors)
    setSyncing(false)

    setTimeout(() => {
      window.location.reload()
    }, 800)
  }

  return (
    <div className="p-4 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Roster Audit
          </h1>

          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            See which active {activeSeason?.name || 'season'} teams have
            published rosters and coaches, then sync every saved Arbiter
            school link without opening them one at a time.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            className="btn-ghost"
            disabled={syncing}
            onClick={() => syncSchools(true)}
          >
            Sync Missing Rosters
          </button>

          <button
            className="btn-primary"
            disabled={syncing}
            onClick={() => syncSchools(false)}
          >
            {syncing ? 'Syncing Section X...' : 'Sync All Linked Schools'}
          </button>
        </div>
      </div>

      {syncing && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{
            background: 'rgba(37,99,235,0.08)',
            border: '1px solid rgba(37,99,235,0.22)',
          }}
        >
          <div className="text-sm font-bold text-blue-300">{progress}</div>
          <div className="text-xs text-slate-500 mt-1">
            {completedSchools} schools completed. Runs sequentially on purpose
            so we do not hammer Arbiter.
          </div>
        </div>
      )}

      {syncErrors.length > 0 && (
        <div
          className="rounded-xl p-4 mb-4"
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.18)',
          }}
        >
          {syncErrors.map((error, index) => (
            <div key={index} className="text-xs text-red-300 mb-1 last:mb-0">
              {error}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
        {[
          ['Active Teams', activeRows.length],
          ['Roster Loaded', rosterLoaded],
          ['Missing', missingRoster],
          ['Athletes', athletes],
          ['Coaches', coaches],
          ['Linked Schools', `${linkedSchools.length}/${schools.length}`],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-4">
            <div className="text-xs text-slate-500">{label}</div>
            <div
              className="text-2xl font-black mt-1 text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label className="text-xs text-slate-500">Sport</label>
        <select
          className="input max-w-sm"
          value={sportFilter}
          onChange={event => setSportFilter(event.target.value)}
        >
          <option value="">All Active Sports</option>
          {sports
            .filter(
              sport =>
                !activeSeason ||
                !sport.season_type ||
                sport.season_type === activeSeason.season_type
            )
            .map(sport => (
              <option key={sport.id} value={sport.id}>
                {displaySportName(sport)}
              </option>
            ))}
        </select>
      </div>

      <div className="rounded-xl overflow-hidden border border-white/[0.07]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(255,255,255,0.025)' }}>
              <tr className="text-slate-500">
                <th className="text-left px-4 py-3 font-medium">Team</th>
                <th className="text-left px-4 py-3 font-medium">Sport</th>
                <th className="text-center px-4 py-3 font-medium">Roster</th>
                <th className="text-center px-4 py-3 font-medium">Coaches</th>
                <th className="text-left px-4 py-3 font-medium">Last Sync</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Open</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map(row => (
                <tr
                  key={row.team.id}
                  className="border-t border-white/[0.05] hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">
                      {row.school.school_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.team.team_name}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-slate-400">
                    {displaySportName(row.sport)}
                  </td>

                  <td className="px-4 py-3 text-center font-mono text-white">
                    {row.rosterCount}
                  </td>

                  <td className="px-4 py-3 text-center font-mono text-white">
                    {row.coachCount}
                  </td>

                  <td className="px-4 py-3 text-xs text-slate-500">
                    {row.lastImported
                      ? new Date(row.lastImported).toLocaleString()
                      : 'Never'}
                  </td>

                  <td className="px-4 py-3">
                    {row.rosterCount > 0 ? (
                      <span className="text-xs font-bold text-emerald-400">
                        ✓ ROSTER LOADED
                      </span>
                    ) : row.school.arbiter_school_url ? (
                      <span className="text-xs font-bold text-amber-400">
                        ○ NOT PUBLISHED / NOT SYNCED
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-red-400">
                        ⚠ NO ARBITER LINK
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/teams/${row.team.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-blue-400 hover:underline"
                    >
                      Team →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRows.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No active teams match this filter.
          </div>
        )}
      </div>
    </div>
  )
}
