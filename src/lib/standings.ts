// src/lib/standings.ts
import type { StandingsRow } from '@/types'

// BTM = Binomial Tournament Method
// Formula: (wins + ties*0.5 + 0.5) / (wins + losses + ties + 1)
function calcBTM(wins: number, losses: number, ties: number): number {
  const w = wins + ties * 0.5
  const total = wins + losses + ties
  if (total === 0) return 0
  return (w + 0.5) / (total + 1)
}

export function calculateStandings(games: any[], teamSeasons?: any[]): StandingsRow[] {
  const map = new Map<string, StandingsRow>()

  // Build division/class lookup from team_seasons
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
        team_id: teamId,
        team_name: teamName,
        school_name: schoolName,
        school_slug: schoolSlug,
        team_slug: teamSlug,
        slug: teamSlug,
        primary_color: primaryColor,
        wins: 0, losses: 0, ties: 0,
        league_wins: 0, league_losses: 0, league_ties: 0,
        points_for: 0, points_against: 0,
        win_pct: 0, league_win_pct: 0, btm: 0,
        class: ts.class,
        division: ts.division,
      })
    }
    return map.get(teamId)!
  }

  for (const game of games) {
    if (game.status !== 'Final') continue
    if (game.home_score == null || game.away_score == null) continue

    const ht = game.home_team
    const at = game.away_team
    const hasHomeTeam = !!game.home_team_id && !!ht
    const hasAwayTeam = !!game.away_team_id && !!at

    // Both Section X teams — full processing
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

      // League game = both teams share same division AND class
      const homeTs = tsMap[game.home_team_id]
      const awayTs = tsMap[game.away_team_id]
      const isLeague = !!(
        homeTs && awayTs &&
        homeTs.division && awayTs.division &&
        homeTs.division === awayTs.division &&
        homeTs.class === awayTs.class
      )

      if (game.home_score > game.away_score) {
        homeRow.wins++; awayRow.losses++
        if (isLeague) { homeRow.league_wins++; awayRow.league_losses++ }
      } else if (game.away_score > game.home_score) {
        awayRow.wins++; homeRow.losses++
        if (isLeague) { awayRow.league_wins++; homeRow.league_losses++ }
      } else {
        homeRow.ties++; awayRow.ties++
        if (isLeague) { homeRow.league_ties++; awayRow.league_ties++ }
      }

    } else if (hasHomeTeam && !hasAwayTeam) {
      // Home is Section X, away is external — count for overall only, never league
      const homeRow = ensure(
        game.home_team_id, ht.team_name,
        ht.school?.school_name || '', ht.school?.slug || '',
        ht.slug, ht.school?.primary_color || '#1e3a5f',
      )
      homeRow.points_for += game.home_score
      homeRow.points_against += game.away_score
      if (game.home_score > game.away_score) homeRow.wins++
      else if (game.away_score > game.home_score) homeRow.losses++
      else homeRow.ties++

    } else if (!hasHomeTeam && hasAwayTeam) {
      // Away is Section X, home is external
      const awayRow = ensure(
        game.away_team_id, at.team_name,
        at.school?.school_name || '', at.school?.slug || '',
        at.slug, at.school?.primary_color || '#1e3a5f',
      )
      awayRow.points_for += game.away_score
      awayRow.points_against += game.home_score
      if (game.away_score > game.home_score) awayRow.wins++
      else if (game.home_score > game.away_score) awayRow.losses++
      else awayRow.ties++
    }
    // Both null = can't attribute to anyone, skip
  }

  const rows = Array.from(map.values())
  rows.forEach(r => {
    const total = r.wins + r.losses + r.ties
    r.win_pct = total > 0 ? r.wins / total : 0
    const leagueTotal = r.league_wins + r.league_losses + r.league_ties
    r.league_win_pct = leagueTotal > 0 ? r.league_wins / leagueTotal : 0
    r.btm = calcBTM(r.wins, r.losses, r.ties)
  })

  return rows.sort((a, b) => {
    if (a.division !== b.division) return (a.division || 'Z').localeCompare(b.division || 'Z')
    if (a.class !== b.class) return (a.class || 'Z').localeCompare(b.class || 'Z')
    return b.btm - a.btm || b.wins - a.wins
  })
}
