// Bradley-Terry Model implementation for Section X standings
// This iterative algorithm weights wins by opponent strength
// Matches the official Section X/NYSPHSAA seeding formula

export interface BTMGame {
  home_team_id: string
  away_team_id: string
  home_score: number
  away_score: number
  is_golf?: boolean
}

export function calculateBTM(
  teamIds: string[],
  games: BTMGame[],
  iterations = 100
): Record<string, number> {
  if (teamIds.length === 0) return {}

  // Initialize all ratings to 1.0
  const ratings: Record<string, number> = {}
  teamIds.forEach(id => { ratings[id] = 1.0 })

  // Build win/loss records between pairs
  // wins[i][j] = number of times team i beat team j
  const wins: Record<string, Record<string, number>> = {}
  const totalGames: Record<string, Record<string, number>> = {}

  teamIds.forEach(i => {
    wins[i] = {}
    totalGames[i] = {}
    teamIds.forEach(j => {
      wins[i][j] = 0
      totalGames[i][j] = 0
    })
  })

  for (const game of games) {
    const h = game.home_team_id
    const a = game.away_team_id
    if (!ratings.hasOwnProperty(h) || !ratings.hasOwnProperty(a)) continue
    if (game.home_score == null || game.away_score == null) continue

    const homeWins = game.is_golf
      ? game.home_score < game.away_score
      : game.home_score > game.away_score
    const awayWins = game.is_golf
      ? game.away_score < game.home_score
      : game.away_score > game.home_score

    if (homeWins) {
      wins[h][a] = (wins[h][a] || 0) + 1
    } else if (awayWins) {
      wins[a][h] = (wins[a][h] || 0) + 1
    }
    // Ties: 0.5 win for each
    else {
      wins[h][a] = (wins[h][a] || 0) + 0.5
      wins[a][h] = (wins[a][h] || 0) + 0.5
    }
    totalGames[h][a] = (totalGames[h][a] || 0) + 1
    totalGames[a][h] = (totalGames[a][h] || 0) + 1
  }

  // Total wins per team
  const totalWins: Record<string, number> = {}
  teamIds.forEach(i => {
    totalWins[i] = Object.values(wins[i]).reduce((s, v) => s + v, 0)
  })

  // Iterative BTM update
  for (let iter = 0; iter < iterations; iter++) {
    const newRatings: Record<string, number> = {}

    for (const i of teamIds) {
      // Denominator: sum of (n_ij / (p_i + p_j)) for all opponents j
      let denom = 0
      for (const j of teamIds) {
        if (i === j) continue
        const games_ij = (totalGames[i][j] || 0)
        if (games_ij === 0) continue
        denom += games_ij / (ratings[i] + ratings[j])
      }

      if (denom === 0) {
        newRatings[i] = ratings[i]
      } else {
        newRatings[i] = totalWins[i] / denom
      }
    }

    // Normalize so ratings sum to number of teams
    const total = Object.values(newRatings).reduce((s, v) => s + v, 0)
    const scale = teamIds.length / (total || 1)
    teamIds.forEach(i => {
      ratings[i] = (newRatings[i] || 0) * scale
    })
  }

  // Convert to 0-1 range (divide by max possible)
  const maxRating = Math.max(...Object.values(ratings))
  const result: Record<string, number> = {}
  teamIds.forEach(id => {
    // Scale to roughly match official BTM range (0-1)
    result[id] = maxRating > 0 ? ratings[id] / (maxRating * 1.01) : 0
  })

  return result
}
