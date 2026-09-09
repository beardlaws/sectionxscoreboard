// Section X Bradley-Terry Model (BTM) ranking calculation.
//
// Each team receives a latent strength rating r. For teams i and j:
//
//   P(i beats j) = exp(r_i) / (exp(r_i) + exp(r_j))
//
// Ratings are fit from head-to-head results with L2 regularization so tiny
// samples, undefeated teams, winless teams, and disconnected schedules stay
// numerically stable. Ties count as half a win for each team.
//
// The public BTM value is the fitted team's win probability against an
// average Section X opponent, so 0.500 is neutral and higher is better.

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
  const ids = [...new Set(teamIds)]
  const index = new Map(ids.map((id, i) => [id, i]))
  const n = ids.length

  if (n === 0) return {}

  type Match = { i: number; j: number; y: number }
  const matches: Match[] = []

  for (const game of games) {
    const i = index.get(game.home_team_id)
    const j = index.get(game.away_team_id)

    if (i == null || j == null || i === j) continue
    if (game.home_score == null || game.away_score == null) continue

    const homeWins = game.is_golf
      ? game.home_score < game.away_score
      : game.home_score > game.away_score

    const awayWins = game.is_golf
      ? game.away_score < game.home_score
      : game.away_score > game.home_score

    matches.push({
      i,
      j,
      y: homeWins ? 1 : awayWins ? 0 : 0.5,
    })
  }

  // With no usable head-to-head results, every team is average.
  if (matches.length === 0) {
    return Object.fromEntries(ids.map(id => [id, 0.5]))
  }

  const ratings = new Array<number>(n).fill(0)

  // A modest ridge penalty keeps sparse early-season schedules sane.
  const ridge = 0.5
  const learningRate = 0.08
  const maxIterations = 5000
  const tolerance = 1e-9

  for (let iter = 0; iter < maxIterations; iter++) {
    const gradient = new Array<number>(n).fill(0)

    for (const match of matches) {
      const diff = Math.max(-30, Math.min(30, ratings[match.i] - ratings[match.j]))
      const p = 1 / (1 + Math.exp(-diff))
      const residual = match.y - p

      gradient[match.i] += residual
      gradient[match.j] -= residual
    }

    let maxChange = 0

    for (let i = 0; i < n; i++) {
      gradient[i] -= ridge * ratings[i]
      const change = learningRate * gradient[i]
      ratings[i] += change
      maxChange = Math.max(maxChange, Math.abs(change))
    }

    // Bradley-Terry ratings are only identifiable up to an additive constant.
    // Centering makes r=0 represent an average opponent.
    const mean = ratings.reduce((sum, r) => sum + r, 0) / n
    for (let i = 0; i < n; i++) ratings[i] -= mean

    if (maxChange < tolerance) break
  }

  const result: Record<string, number> = {}

  for (let i = 0; i < n; i++) {
    result[ids[i]] = 1 / (1 + Math.exp(-ratings[i]))
  }

  return result
}
