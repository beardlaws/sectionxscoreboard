import type { StandingsRow } from '@/types'

function calcBTM(wins: number, losses: number, ties: number): number {
  const w = wins + ties * 0.5
  const total = wins + losses + ties
  if (total === 0) return 0
  return (w + 0.5) / (total + 1)
}

export function calculateStandings(games: any[], teamSeasons?: any[], sportName?: string): StandingsRow[] {
  const map = new Map<string, StandingsRow>()

  // Golf: LOWER score wins
  const isGolf = !!(sportName?.toLowerCase().includes('golf'))

  const tsMap: Record<string, { division: string; class: string }> = {}
  if (teamSeasons) {
    for (const ts of teamSeasons) {
      if (ts.team_id) tsMap[ts.team_id] = { division: ts.division || '', class: ts.class || '' }
    }
  }

  const ensure = (teamId: string, teamName: string, schoolName: string, schoolSlug: string, teamSlug: string, primaryColor: string): StandingsRow => {
    if (!map.has(teamId)) {
      const ts = tsMap[teamId] || { division: '', class: '' }
      map.set(teamId, {
        team_id: teamId, team_name: teamName, school_name: schoolName,
        school_slug: schoolSlug, team_slug: teamSlug, slug: teamSlug,
        primary_color: primaryColor,
        wins: 0, losses: 0, ties: 0,
        league_wins: 0, league_losses: 0, league_ties: 0,
        points_for: 0, points_against: 0,
        win_pct: 0, league_win_pct: 0, btm: 0,
        class: ts.class, division: ts.division,
      })
    }
    return map.get(teamId)!
  }

  const didHomeWin = (homeScore: number, awayScore: number): boolean =>
    isGolf ? homeScore < awayScore : homeScore > awayScore
  const didAwayWin = (homeScore: number, awayScore: number): boolean =>
    isGolf ? awayScore < homeScore : awayScore > homeScore

  for (const game of games) {
    if (game.status !== 'Final') continue
    if (game.home_score == null || game.away_score == null) continue

    const ht = game.home_team
    const at = game.away_team
    const hasHomeTeam = !!game.home_team_id && !!ht
    const hasAwayTeam = !!game.away_team_id && !!at

    if (hasHomeTeam && hasAwayTeam) {
      const homeRow = ensure(
        game.home_team_id, ht.team_name,
        ht.school?.school_name || '', ht.school?.slug || '',
        ht.slug, ht.school?.primary_color || '#1e3a5f',
      )
      const awayRow = ensure(
        game.away_team_id, at.team_name,
        at.school?.school_name || '', at.school?.slug || '',
        at.slug, at.school?.primary_color || '#1e3a5f',
      )

      homeRow.points_for += game.home_score
      homeRow.points_against += game.away_score
      awayRow.points_for += game.away_score
      awayRow.points_against += game.home_score

      // Golf: all games count as league. Others: same division only
      const homeTs = tsMap[game.home_team_id]
      const awayTs = tsMap[game.away_team_id]
      const isLeague = isGolf ? true : !!(
        homeTs && awayTs &&
        homeTs.division && awayTs.division &&
        homeTs.division === awayTs.division
      )

      if (didHomeWin(game.home_score, game.away_score)) {
        homeRow.wins++; awayRow.losses++
        if (isLeague) { homeRow.league_wins++; awayRow.league_losses++ }
      } else if (didAwayWin(game.home_score, game.away_score)) {
        awayRow.wins++; homeRow.losses++
        if (isLeague) { awayRow.league_wins++; homeRow.league_losses++ }
      } else {
        homeRow.ties++; awayRow.ties++
        if (isLeague) { homeRow.league_ties++; awayRow.league_ties++ }
      }

    } else if (hasHomeTeam && !hasAwayTeam) {
      const homeRow = ensure(
        game.home_team_id, ht.team_name,
        ht.school?.school_name || '', ht.school?.slug || '',
        ht.slug, ht.school?.primary_color || '#1e3a5f',
      )
      homeRow.points_for += game.home_score
      homeRow.points_against += game.away_score
      if (didHomeWin(game.home_score, game.away_score)) homeRow.wins++
      else if (didAwayWin(game.home_score, game.away_score)) homeRow.losses++
      else homeRow.ties++

    } else if (!hasHomeTeam && hasAwayTeam) {
      const awayRow = ensure(
        game.away_team_id, at.team_name,
        at.school?.school_name || '', at.school?.slug || '',
        at.slug, at.school?.primary_color || '#1e3a5f',
      )
      awayRow.points_for += game.away_score
      awayRow.points_against += game.home_score
      if (didAwayWin(game.home_score, game.away_score)) awayRow.wins++
      else if (didHomeWin(game.home_score, game.away_score)) awayRow.losses++
      else awayRow.ties++
    }
  }

  const rows = Array.from(map.values())
  rows.forEach(r => {
    const total = r.wins + r.losses + r.ties
    r.win_pct = total > 0 ? r.wins / total : 0
    const lt = r.league_wins + r.league_losses + r.league_ties
    r.league_win_pct = lt > 0 ? r.league_wins / lt : 0
    r.btm = calcBTM(r.wins, r.losses, r.ties)
  })

  const DIVISION_ORDER = ['East', 'Central', 'West', 'North', 'South']
  return rows.sort((a, b) => {
    const aDivIdx = DIVISION_ORDER.indexOf(a.division || '')
    const bDivIdx = DIVISION_ORDER.indexOf(b.division || '')
    if (aDivIdx !== bDivIdx) {
      if (aDivIdx === -1) return 1
      if (bDivIdx === -1) return -1
      return aDivIdx - bDivIdx
    }
    return b.btm - a.btm || b.wins - a.wins
  })
}
