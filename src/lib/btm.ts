// Section X Bradley-Terry Model (BTM) ranking calculation.
//
// Each team gets a latent strength rating. For a matchup between teams i and j,
// the Bradley-Terry model estimates:
//
//   P(i beats j) = exp(r_i) / (exp(r_i) + exp(r_j))
//
// We fit those ratings with a small L2 regularization term so tiny samples,
// undefeated teams, and winless teams do not produce infinite ratings.
// Ties count as half a win for each team.
//
// The public BTM value is the fitted team's win probability against an
// average Section X opponent. That keeps the display intuitive (0.000-1.000)
// while preserving the Bradley-Terry ordering.

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

  type Match = { i: number; j: number; scoreI: number }
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
      scoreI: homeWins ? 1 : awayWins ? 0 : 0.5,
    })
  }

  // No results yet: every team is exactly average.
  if (matches.length === 0) {
    return Object.fromEntries(ids.map(id => [id, 0.5]))
  }

  const ratings = new Array<number>(n).fill(0)
  const ridge = 0.35
  const maxIterations = 200
  const tolerance = 1e-8

  for (let iter = 0; iter < maxIterations; iter++) {
    const gradient = new Array<number>(n).fill(0)
    const hessianDiag = new Array<number>(n).fill(ridge)

    for (const match of matches) {
      const diff = Math.max(-30, Math.min(30, ratings[match.i] - ratings[match.j]))
      const p = 1 / (1 + Math.exp(-diff))
      const residual = match.scoreI - p
      const weight = p * (1 - p)

      gradient[match.i] += residual
      gradient[match.j] -= residual
      hessianDiag[match.i] += weight
      hessianDiag[match.j] += weight
    }

    for (let i = 0; i < n; i++) {
      gradient[i] -= ridge * ratings[i]
    }

    let maxChange = 0
    for (let i = 0; i < n; i++) {
      const step = gradient[i] / hessianDiag[i]
      ratings[i] += step
      maxChange = Math.max(maxChange, Math.abs(step))
    }

    // Bradley-Terry ratings are identifiable only up to an additive constant.
    // Centering after each iteration makes zero mean "average opponent".
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
