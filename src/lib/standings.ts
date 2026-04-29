// src/lib/standings.ts
import type { Game, StandingsRow } from '@/types'

export function calculateStandings(games: Game[]): StandingsRow[] {
  const map = new Map<string, StandingsRow>()

  const ensure = (teamId: string, teamName: string, schoolName: string, schoolSlug: string, teamSlug: string, cls: string, division: string) => {
    if (!map.has(teamId)) {
      map.set(teamId, {
        team_id: teamId,
        team_name: teamName,
        school_name: schoolName,
        school_slug: schoolSlug,
        team_slug: teamSlug,
        wins: 0, losses: 0, ties: 0,
        points_for: 0, points_against: 0,
        win_pct: 0,
        class: cls,
        division,
      })
    }
    return map.get(teamId)!
  }

  for (const game of games) {
    if (game.status !== 'Final') continue
    if (game.home_score === null || game.away_score === null) continue
    if (!game.home_team_id || !game.away_team_id) continue

    const ht = game.home_team
    const at = game.away_team

    if (!ht || !at) continue

    const homeRow = ensure(
      game.home_team_id,
      ht.team_name,
      ht.school?.school_name || '',
      ht.school?.slug || '',
      ht.slug,
      '', ''
    )
    const awayRow = ensure(
      game.away_team_id,
      at.team_name,
      at.school?.school_name || '',
      at.school?.slug || '',
      at.slug,
      '', ''
    )

    homeRow.points_for += game.home_score
    homeRow.points_against += game.away_score
    awayRow.points_for += game.away_score
    awayRow.points_against += game.home_score

    if (game.home_score > game.away_score) {
      homeRow.wins++
      awayRow.losses++
    } else if (game.away_score > game.home_score) {
      awayRow.wins++
      homeRow.losses++
    } else {
      homeRow.ties++
      awayRow.ties++
    }
  }

  const rows = Array.from(map.values())
  rows.forEach(r => {
    const total = r.wins + r.losses + r.ties
    r.win_pct = total > 0 ? r.wins / total : 0
  })

  return rows.sort((a, b) => b.win_pct - a.win_pct || b.wins - a.wins)
}
