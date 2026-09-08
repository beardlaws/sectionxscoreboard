export type CrossCountryStanding = {
  team_id: string
  team_name: string
  school_name: string
  school_slug: string
  wins: number
  losses: number
  ties: number
  win_pct: number
}

export function xcTeamName(result: any) {
  return result?.team?.school?.school_name || result?.team?.team_name || result?.external_opponent?.name || 'Unknown Team'
}

export function calculateCrossCountryStandings(
  meets: any[],
  results: any[],
  teamSeasons: any[],
  sportId: string
): CrossCountryStanding[] {
  const rows = new Map<string, CrossCountryStanding>()

  for (const record of teamSeasons || []) {
    const team = Array.isArray(record.team) ? record.team[0] : record.team
    if (!team || team.sport_id !== sportId || team.active === false) continue
    const school = Array.isArray(team.school) ? team.school[0] : team.school
    if (!school?.is_section_x) continue
    rows.set(team.id, {
      team_id: team.id,
      team_name: team.team_name,
      school_name: school.school_name,
      school_slug: school.slug,
      wins: 0,
      losses: 0,
      ties: 0,
      win_pct: 0,
    })
  }

  const leagueMeetIds = new Set(
    (meets || [])
      .filter(m => m.status === 'Final' && m.meet_type === 'League')
      .map(m => m.id)
  )

  const byMeet = new Map<string, any[]>()
  for (const result of results || []) {
    if (result.sport_id !== sportId || !leagueMeetIds.has(result.meet_id)) continue
    if (!result.team_id || result.team_score == null || !rows.has(result.team_id)) continue
    if (!byMeet.has(result.meet_id)) byMeet.set(result.meet_id, [])
    byMeet.get(result.meet_id)!.push(result)
  }

  for (const meetResults of byMeet.values()) {
    for (let i = 0; i < meetResults.length; i++) {
      for (let j = i + 1; j < meetResults.length; j++) {
        const a = meetResults[i]
        const b = meetResults[j]
        const ar = rows.get(a.team_id)!
        const br = rows.get(b.team_id)!
        if (a.team_score < b.team_score) {
          ar.wins++; br.losses++
        } else if (b.team_score < a.team_score) {
          br.wins++; ar.losses++
        } else {
          ar.ties++; br.ties++
        }
      }
    }
  }

  return [...rows.values()]
    .map(row => {
      const decisions = row.wins + row.losses + row.ties
      return { ...row, win_pct: decisions ? (row.wins + row.ties * 0.5) / decisions : 0 }
    })
    .sort((a, b) => b.win_pct - a.win_pct || b.wins - a.wins || a.losses - b.losses || a.school_name.localeCompare(b.school_name))
}
