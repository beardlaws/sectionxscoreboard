import type { StandingsRow } from '@/types'
import { calculateBTM } from './btm'

function normalizeJoinedRecord<T = any>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

export function calculateStandings(
  games: any[],
  teamSeasons?: any[],
  sportName?: string
): StandingsRow[] {
  const map = new Map<string, StandingsRow>()
  const isGolf = !!sportName?.toLowerCase().includes('golf')

  const tsMap: Record<string, { division: string; class: string; btm_override?: number; active_for_season?: boolean | null }> = {}

  const ensure = (
    teamId: string,
    teamName: string,
    schoolName: string,
    schoolSlug: string,
    teamSlug: string,
    primaryColor: string
  ): StandingsRow => {
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
        wins: 0,
        losses: 0,
        ties: 0,
        league_wins: 0,
        league_losses: 0,
        league_ties: 0,
        points_for: 0,
        points_against: 0,
        win_pct: 0,
        league_win_pct: 0,
        btm: 0,
        class: ts.class,
        division: ts.division,
      })
    }
    return map.get(teamId)!
  }

  if (teamSeasons) {
    for (const ts of teamSeasons) {
      if (!ts?.team_id) continue

      tsMap[ts.team_id] = {
        division: ts.division || '',
        class: ts.class || '',
        btm_override: ts.btm_override ?? undefined,
        active_for_season: ts.active_for_season,
      }

      if (ts.active_for_season === false) continue

      const team = normalizeJoinedRecord<any>(ts.team)
      if (!team) continue

      const school = normalizeJoinedRecord<any>(team.school)

      ensure(
        ts.team_id,
        team.team_name || '',
        school?.school_name || '',
        school?.slug || '',
        team.slug || '',
        school?.primary_color || '#1e3a5f'
      )
    }
  }

  const didHomeWin = (hs: number, as_: number) => isGolf ? hs < as_ : hs > as_
  const didAwayWin = (hs: number, as_: number) => isGolf ? as_ < hs : as_ > hs

  for (const game of games) {
    if (game.status !== 'Final') continue
    if (game.home_score == null || game.away_score == null) continue

    const ht = normalizeJoinedRecord<any>(game.home_team)
    const at = normalizeJoinedRecord<any>(game.away_team)

    const hasHome = !!game.home_team_id && !!ht
    const hasAway = !!game.away_team_id && !!at

    const homeSchool = normalizeJoinedRecord<any>(ht?.school)
    const awaySchool = normalizeJoinedRecord<any>(at?.school)

    const homeRow = hasHome ? ensure(
      game.home_team_id,
      ht.team_name,
      homeSchool?.school_name || '',
      homeSchool?.slug || '',
      ht.slug,
      homeSchool?.primary_color || '#1e3a5f'
    ) : null

    const awayRow = hasAway ? ensure(
      game.away_team_id,
      at.team_name,
      awaySchool?.school_name || '',
      awaySchool?.slug || '',
      at.slug,
      awaySchool?.primary_color || '#1e3a5f'
    ) : null

    if (!homeRow && !awayRow) continue

    if (homeRow) {
      homeRow.points_for += game.home_score
      homeRow.points_against += game.away_score
    }

    if (awayRow) {
      awayRow.points_for += game.away_score
      awayRow.points_against += game.home_score
    }

    const homeIsSectionX = hasHome && homeSchool?.is_section_x !== false
    const awayIsSectionX = hasAway && awaySchool?.is_section_x !== false
    const isSeeding = isGolf ? true : (homeIsSectionX && awayIsSectionX)

    const hw = didHomeWin(game.home_score, game.away_score)
    const aw = didAwayWin(game.home_score, game.away_score)

    if (hw) {
      if (homeRow) { homeRow.wins++; if (isSeeding) homeRow.league_wins++ }
      if (awayRow) { awayRow.losses++; if (isSeeding) awayRow.league_losses++ }
    } else if (aw) {
      if (awayRow) { awayRow.wins++; if (isSeeding) awayRow.league_wins++ }
      if (homeRow) { homeRow.losses++; if (isSeeding) homeRow.league_losses++ }
    } else {
      if (homeRow) { homeRow.ties++; if (isSeeding) homeRow.league_ties++ }
      if (awayRow) { awayRow.ties++; if (isSeeding) awayRow.league_ties++ }
    }
  }

  const rows = Array.from(map.values())

  rows.forEach(r => {
    const total = r.wins + r.losses + r.ties
    r.win_pct = total > 0 ? r.wins / total : 0

    const lt = r.league_wins + r.league_losses + r.league_ties
    r.league_win_pct = lt > 0 ? r.league_wins / lt : 0
  })

  const teamIds = rows.map(r => r.team_id)
  const hasOverrides = rows.some(r => tsMap[r.team_id]?.btm_override != null)

  const btmGames = games
    .filter(g =>
      g.status === 'Final' &&
      g.home_score != null &&
      g.away_score != null &&
      g.home_team_id &&
      g.away_team_id
    )
    .map(g => ({
      home_team_id: g.home_team_id,
      away_team_id: g.away_team_id,
      home_score: g.home_score,
      away_score: g.away_score,
      is_golf: isGolf,
    }))

  const calculated = calculateBTM(teamIds, btmGames)

  rows.forEach(r => {
    const override = tsMap[r.team_id]?.btm_override
    r.btm = (hasOverrides && override != null) ? override : (calculated[r.team_id] || 0)
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

    const ranked = b.btm - a.btm || b.wins - a.wins || a.losses - b.losses
    if (ranked !== 0) return ranked

    return (a.school_name || a.team_name).localeCompare(b.school_name || b.team_name)
  })
}
