// Section X Binomial Tournament Method (BTM) seeding calculation.
// Applies a 0.5 prior so undefeated/winless teams are not pinned at 1.000/0.000
// after a very small number of league games.

export interface BTMGame {
  home_team_id: string
  away_team_id: string
  home_score: number
  away_score: number
  is_golf?: boolean
}

export function calculateBTM(
  teamIds: string[],
  games: BTMGame[]
): Record<string, number> {
  const records: Record<string, { wins: number; losses: number; ties: number }> = {}
  for (const id of teamIds) records[id] = { wins: 0, losses: 0, ties: 0 }

  for (const game of games) {
    const home = records[game.home_team_id]
    const away = records[game.away_team_id]
    if (!home || !away || game.home_score == null || game.away_score == null) continue

    const homeWins = game.is_golf ? game.home_score < game.away_score : game.home_score > game.away_score
    const awayWins = game.is_golf ? game.away_score < game.home_score : game.away_score > game.home_score

    if (homeWins) {
      home.wins++
      away.losses++
    } else if (awayWins) {
      away.wins++
      home.losses++
    } else {
      home.ties++
      away.ties++
    }
  }

  const result: Record<string, number> = {}
  for (const id of teamIds) {
    const r = records[id]
    const gamesPlayed = r.wins + r.losses + r.ties
    const effectiveWins = r.wins + (0.5 * r.ties)
    result[id] = (effectiveWins + 0.5) / (gamesPlayed + 1)
  }
  return result
}
