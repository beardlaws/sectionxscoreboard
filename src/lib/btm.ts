// Section X Bradley-Terry Model (BTM) ranking calculation.
//
// This implementation follows the standard Bradley-Terry / Zermelo maximum-
// likelihood iteration described in the published sports-ranking literature.
//
// For teams i and j with positive ability parameters p_i and p_j:
//
//   P(i beats j) = p_i / (p_i + p_j)
//
// Zermelo update:
//
//   p_i(new) = W_i / SUM[j != i] (n_ij / (p_i + p_j))
//
// where W_i is team i's total wins and n_ij is the number of comparisons
// between i and j. Parameters are normalized after each iteration and the
// process repeats until convergence.
//
// Important Section-style rules:
// - Only the game outcome matters. Score margin is NOT an input.
// - Home/away location is NOT weighted.
// - A tie is treated as 0.5 win + 0.5 loss for ranking purposes.
// - The model is fit on the complete in-section comparison network supplied
//   by the caller, not just games within a team's playoff class.
// - The model itself is classification-blind: every eligible in-section team
//   is fit in one shared comparison network.
// - The displayed BTM score is the team's average Bradley-Terry predicted win
//   probability against the other modeled Section X teams. Class/division
//   filters only change which rows are displayed; they do not refit the model.
//
// Teams with no usable in-section results are not identifiable by Bradley-
// Terry. They are displayed at 0.500 (neutral) until they enter the comparison
// network. This is a presentation fallback, not a pseudo-game or model input.

export interface BTMGame {
  home_team_id: string
  away_team_id: string
  home_score: number
  away_score: number
  is_golf?: boolean
}

interface FitResult {
  ability: Record<string, number>
  gamesPlayed: Record<string, number>
}

function fitBradleyTerryAbilities(
  teamIds: string[],
  games: BTMGame[]
): FitResult {
  const ids = [...new Set(teamIds)]
  const index = new Map(ids.map((id, i) => [id, i]))
  const n = ids.length

  const wins = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const gamesPlayed = new Array<number>(n).fill(0)

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

    if (homeWins) {
      wins[i][j] += 1
    } else if (awayWins) {
      wins[j][i] += 1
    } else {
      // For ranking purposes, a draw is half a win and half a loss.
      wins[i][j] += 0.5
      wins[j][i] += 0.5
    }

    gamesPlayed[i] += 1
    gamesPlayed[j] += 1
  }

  const active = ids.map((_, i) => gamesPlayed[i] > 0)
  const activeCount = active.filter(Boolean).length

  const ability: Record<string, number> = {}
  const played: Record<string, number> = {}

  for (let i = 0; i < n; i++) played[ids[i]] = gamesPlayed[i]

  if (activeCount === 0) {
    for (const id of ids) ability[id] = 0
    return { ability, gamesPlayed: played }
  }

  // Zermelo's published iteration starts every active parameter at one.
  // Normalizing immediately is scale-equivalent and improves numerical range.
  let p = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++) {
    if (active[i]) p[i] = 1 / activeCount
  }

  const totalWins = wins.map(row => row.reduce((sum, value) => sum + value, 0))
  const maxIterations = 10000
  const tolerance = 1e-12
  const EPS = 1e-15

  for (let iter = 0; iter < maxIterations; iter++) {
    const next = new Array<number>(n).fill(0)

    for (let i = 0; i < n; i++) {
      if (!active[i]) continue

      let denominator = 0

      for (let j = 0; j < n; j++) {
        if (i === j) continue

        const nij = wins[i][j] + wins[j][i]
        if (nij <= 0) continue

        const pairStrength = p[i] + p[j]
        if (pairStrength > EPS) {
          denominator += nij / pairStrength
        }
      }

      // This is the exact Zermelo/MM update. A team with no wins can
      // legitimately converge to zero ability under the unpenalized MLE.
      next[i] = denominator > 0 ? totalWins[i] / denominator : p[i]
    }

    const sum = next.reduce((acc, value, i) => active[i] ? acc + value : acc, 0)

    if (sum <= EPS) {
      // Degenerate comparison data: retain the previous valid iterate rather
      // than manufacture pseudo-results.
      break
    }

    for (let i = 0; i < n; i++) {
      if (active[i]) next[i] /= sum
    }

    let maxChange = 0
    for (let i = 0; i < n; i++) {
      if (!active[i]) continue
      maxChange = Math.max(maxChange, Math.abs(next[i] - p[i]))
    }

    p = next
    if (maxChange < tolerance) break
  }

  for (let i = 0; i < n; i++) {
    ability[ids[i]] = active[i] ? p[i] : 0
  }

  return { ability, gamesPlayed: played }
}

export function calculateBTM(
  teamIds: string[],
  games: BTMGame[]
): Record<string, number> {
  const ids = [...new Set(teamIds)]
  const { ability, gamesPlayed } = fitBradleyTerryAbilities(ids, games)
  const result: Record<string, number> = {}
  const EPS = 1e-15

  const modeledIds = ids.filter(id => (gamesPlayed[id] || 0) > 0)

  for (const id of ids) {
    if ((gamesPlayed[id] || 0) === 0) {
      result[id] = 0.5
      continue
    }

    const opponents = modeledIds.filter(otherId => otherId !== id)

    if (opponents.length === 0) {
      result[id] = 0.5
      continue
    }

    let probabilitySum = 0
    let probabilityCount = 0

    for (const opponentId of opponents) {
      const pi = ability[id] || 0
      const pj = ability[opponentId] || 0
      const denominator = pi + pj

      // If both MLE abilities are zero, the pair is not meaningfully
      // distinguishable from this data and is omitted from the average.
      if (denominator <= EPS) continue

      probabilitySum += pi / denominator
      probabilityCount += 1
    }

    result[id] = probabilityCount > 0
      ? probabilitySum / probabilityCount
      : 0.5
  }

  return result
}
