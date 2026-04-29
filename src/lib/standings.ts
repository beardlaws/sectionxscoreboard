// src/lib/standings.ts
import type { StandingsRow } from '@/types'

export function calculateStandings(games: any[], teamSeasons?: any[]): StandingsRow[] {
  const map = new Map<string, StandingsRow>()

  // Build division/class lookup from team_seasons if provided
  const tsMap: Record<string, { division: string; class: string }> = {}
  if (teamSeasons) {
    for (const ts of teamSeasons) {
      tsMap[ts.team_id] = { division: ts.division || '', class: ts.class || '' }
    }
  }

  const ensure = (teamId: string, teamName: string, schoolName: string, schoolSlug: string, teamSlug: string, primaryColor: string) => {
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
        points_for: 0, points_against: 0,
        win_pct: 0,
        class: ts.class,
        division: ts.division,
      })
    }
    return map.get(teamId)!
  }

  for (const game of games) {
    if (game.status !== 'Final') continue
    if (game.home_score == null || game.away_score == null) continue
    if (!game.home_team_id || !game.away_team_id) continue

    const ht = game.home_team
    const at = game.away_team
    if (!ht || !at) continue

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

    if (game.home_score > game.away_score) { homeRow.wins++; awayRow.losses++ }
    else if (game.away_score > game.home_score) { awayRow.wins++; homeRow.losses++ }
    else { homeRow.ties++; awayRow.ties++ }
  }

  const rows = Array.from(map.values())
  rows.forEach(r => {
    const total = r.wins + r.losses + r.ties
    r.win_pct = total > 0 ? r.wins / total : 0
  })

  return rows.sort((a, b) => {
    // Sort by division first, then win_pct
    if (a.division < b.division) return -1
    if (a.division > b.division) return 1
    return b.win_pct - a.win_pct || b.wins - a.wins
  })
}
