import type { GameCenterRepository } from './game-center-repository'
import { isScrimmage } from '@/lib/gameType'

function placeholders(count: number) {
  return Array.from({ length: count }, () => '?').join(',')
}

function mapGame(row: any) {
  if (!row) return null
  const game = {
    id: row.id,
    season_id: row.season_id,
    sport_id: row.sport_id,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    external_home_opponent_id: row.external_home_opponent_id,
    external_away_opponent_id: row.external_away_opponent_id,
    game_date: row.game_date,
    game_time: row.game_time,
    location: row.location,
    home_score: row.home_score,
    away_score: row.away_score,
    status: row.status,
    verification_status: row.verification_status,
    source: row.source,
    notes: row.notes,
    contest_type: row.contest_type || 'Game',
    featured: Boolean(row.featured),
    game_of_the_night: Boolean(row.game_of_the_night),
    rescheduled_date: row.rescheduled_date,
    doubleheader_group_id: row.doubleheader_group_id,
    game_number: row.game_number,
    event_name: row.event_name,
    neutral_site: Boolean(row.neutral_site),
    parser_confidence: row.parser_confidence,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sport: row.sport_id ? {
      id: row.sport_id,
      sport_name: row.sport_name,
      gender: row.sport_gender,
      slug: row.sport_slug,
      season_type: row.sport_season_type,
    } : null,
    season: row.season_id ? {
      id: row.season_id,
      name: row.season_name,
      year: row.season_year,
      season_type: row.season_type,
      is_active: Boolean(row.season_is_active),
    } : null,
    home_team: row.home_team_id ? {
      id: row.home_team_id,
      team_name: row.home_team_name,
      slug: row.home_team_slug,
      level: row.home_team_level,
      school: row.home_school_id ? {
        id: row.home_school_id,
        school_name: row.home_school_name,
        mascot: row.home_school_mascot,
        city: row.home_school_city,
        county: row.home_school_county,
        alias: row.home_school_alias,
        slug: row.home_school_slug,
        logo_url: row.home_school_logo_url,
        primary_color: row.home_school_primary_color,
        secondary_color: row.home_school_secondary_color,
        is_section_x: row.home_school_is_section_x == null ? true : Boolean(row.home_school_is_section_x),
      } : null,
    } : null,
    away_team: row.away_team_id ? {
      id: row.away_team_id,
      team_name: row.away_team_name,
      slug: row.away_team_slug,
      level: row.away_team_level,
      school: row.away_school_id ? {
        id: row.away_school_id,
        school_name: row.away_school_name,
        mascot: row.away_school_mascot,
        city: row.away_school_city,
        county: row.away_school_county,
        alias: row.away_school_alias,
        slug: row.away_school_slug,
        logo_url: row.away_school_logo_url,
        primary_color: row.away_school_primary_color,
        secondary_color: row.away_school_secondary_color,
        is_section_x: row.away_school_is_section_x == null ? true : Boolean(row.away_school_is_section_x),
      } : null,
    } : null,
    external_home: row.external_home_opponent_id ? {
      id: row.external_home_opponent_id,
      name: row.external_home_name,
      slug: row.external_home_slug,
      city: row.external_home_city,
      state: row.external_home_state,
      section: row.external_home_section,
    } : null,
    external_away: row.external_away_opponent_id ? {
      id: row.external_away_opponent_id,
      name: row.external_away_name,
      slug: row.external_away_slug,
      city: row.external_away_city,
      state: row.external_away_state,
      section: row.external_away_section,
    } : null,
  }
  return isScrimmage(game) ? { ...game, status: 'Scrimmage', home_score: null, away_score: null } : game
}

const GAME_JOIN = `
  SELECT g.*,
    sp.sport_name, sp.gender AS sport_gender, sp.slug AS sport_slug, sp.season_type AS sport_season_type,
    se.name AS season_name, se.year AS season_year, se.season_type, se.is_active AS season_is_active,
    ht.team_name AS home_team_name, ht.slug AS home_team_slug, ht.level AS home_team_level,
    hs.id AS home_school_id, hs.school_name AS home_school_name, hs.mascot AS home_school_mascot,
    hs.city AS home_school_city, hs.county AS home_school_county, hs.alias AS home_school_alias,
    hs.slug AS home_school_slug, hs.logo_url AS home_school_logo_url, hs.primary_color AS home_school_primary_color,
    hs.secondary_color AS home_school_secondary_color, hs.is_section_x AS home_school_is_section_x,
    at.team_name AS away_team_name, at.slug AS away_team_slug, at.level AS away_team_level,
    aws.id AS away_school_id, aws.school_name AS away_school_name, aws.mascot AS away_school_mascot,
    aws.city AS away_school_city, aws.county AS away_school_county, aws.alias AS away_school_alias,
    aws.slug AS away_school_slug, aws.logo_url AS away_school_logo_url, aws.primary_color AS away_school_primary_color,
    aws.secondary_color AS away_school_secondary_color, aws.is_section_x AS away_school_is_section_x,
    eh.name AS external_home_name, eh.slug AS external_home_slug, eh.city AS external_home_city,
    eh.state AS external_home_state, eh.section AS external_home_section,
    ea.name AS external_away_name, ea.slug AS external_away_slug, ea.city AS external_away_city,
    ea.state AS external_away_state, ea.section AS external_away_section
  FROM games g
  LEFT JOIN sports sp ON sp.id = g.sport_id
  LEFT JOIN seasons se ON se.id = g.season_id
  LEFT JOIN teams ht ON ht.id = g.home_team_id
  LEFT JOIN schools hs ON hs.id = ht.school_id
  LEFT JOIN teams at ON at.id = g.away_team_id
  LEFT JOIN schools aws ON aws.id = at.school_id
  LEFT JOIN external_opponents eh ON eh.id = g.external_home_opponent_id
  LEFT JOIN external_opponents ea ON ea.id = g.external_away_opponent_id
`

async function queryGames(db: any, where: string, binds: unknown[], order = 'g.game_date ASC, g.game_time ASC', limit?: number) {
  let sql = `${GAME_JOIN} WHERE ${where} ORDER BY ${order}`
  if (limit) sql += ` LIMIT ${Number(limit)}`
  const result = await db.prepare(sql).bind(...binds).all()
  return (result.results || []).map(mapGame)
}

export class D1GameCenterRepository implements GameCenterRepository {
  constructor(private db: any) {}

  async getGame(id: string) {
    const rows = await queryGames(this.db, 'g.id = ?', [id], 'g.game_date DESC', 1)
    return rows[0] || null
  }

  async getGamePhotos(gameId: string) {
    const result = await this.db.prepare(`SELECT * FROM photos WHERE game_id = ? AND approved = 1 ORDER BY featured DESC, created_at DESC`).bind(gameId).all()
    return (result.results || []).map((r:any)=>({ ...r, approved:Boolean(r.approved), featured:Boolean(r.featured), permission_confirmed:Boolean(r.permission_confirmed) }))
  }

  async getPeriodScores(gameId: string) {
    const result = await this.db.prepare(`SELECT * FROM game_period_scores WHERE game_id = ? ORDER BY period_number ASC, team_side ASC`).bind(gameId).all()
    return result.results || []
  }

  async getTeamStats(gameId: string) {
    const result = await this.db.prepare(`
      SELECT gs.*, sd.id AS def_id, sd.label AS def_label, sd.unit AS def_unit, sd.sort_order AS def_sort_order
      FROM game_team_stats gs
      JOIN stat_definitions sd ON sd.id = gs.stat_definition_id
      WHERE gs.game_id = ?
      ORDER BY sd.sort_order ASC, sd.label ASC
    `).bind(gameId).all()
    return (result.results || []).map((r:any)=>({ ...r, verified:Boolean(r.verified), stat_definition:{ id:r.def_id, label:r.def_label, unit:r.def_unit, sort_order:r.def_sort_order } }))
  }

  async getAthleteStats(gameId: string) {
    const result = await this.db.prepare(`
      SELECT gs.*, a.display_name, a.slug AS athlete_slug,
             sd.id AS def_id, sd.label AS def_label, sd.unit AS def_unit, sd.sort_order AS def_sort_order
      FROM game_athlete_stats gs
      JOIN athletes a ON a.id = gs.athlete_id
      JOIN stat_definitions sd ON sd.id = gs.stat_definition_id
      WHERE gs.game_id = ?
      ORDER BY a.display_name ASC, sd.sort_order ASC, sd.label ASC
    `).bind(gameId).all()
    return (result.results || []).map((r:any)=>({ ...r, verified:Boolean(r.verified), athlete:{id:r.athlete_id,display_name:r.display_name,slug:r.athlete_slug}, stat_definition:{id:r.def_id,label:r.def_label,unit:r.def_unit,sort_order:r.def_sort_order} }))
  }

  async getTeamSeasons(sportId: string, seasonId: string) {
    const result = await this.db.prepare(`
      SELECT ts.*, t.team_name, t.slug AS team_slug, t.sport_id, t.level, t.active,
             s.id AS school_id, s.school_name, s.slug AS school_slug, s.primary_color, s.is_section_x
      FROM team_seasons ts
      JOIN teams t ON t.id = ts.team_id
      JOIN schools s ON s.id = t.school_id
      WHERE ts.season_id = ? AND t.sport_id = ? AND ts.active_for_season != 0 AND t.active = 1
    `).bind(seasonId, sportId).all()
    return (result.results || []).map((r:any)=>({
      team_id:r.team_id, season_id:r.season_id, division:r.division, class:r.class, btm_override:r.btm_override,
      active_for_season:Boolean(r.active_for_season),
      team:{id:r.team_id,team_name:r.team_name,slug:r.team_slug,sport_id:r.sport_id,level:r.level,active:Boolean(r.active),school:{id:r.school_id,school_name:r.school_name,slug:r.school_slug,primary_color:r.primary_color,is_section_x:r.is_section_x == null ? true : Boolean(r.is_section_x)}}
    }))
  }

  async getStandingsGames(sportId: string, seasonId: string) {
    return queryGames(this.db, `g.sport_id = ? AND g.season_id = ? AND lower(g.status) = 'final' AND lower(coalesce(g.contest_type,'Game')) != 'scrimmage'`, [sportId, seasonId], 'g.game_date DESC, g.game_time DESC')
  }

  async getGamesOnDate(date: string, excludeId?: string | null, limit = 8) {
    const where = excludeId ? 'g.game_date = ? AND g.id != ?' : 'g.game_date = ?'
    const binds = excludeId ? [date, excludeId] : [date]
    return queryGames(this.db, where, binds, 'g.game_time ASC, g.id ASC', limit)
  }

  async getTeamSchedule(teamId: string, sportId: string, seasonId: string) {
    return queryGames(this.db, `g.season_id = ? AND g.sport_id = ? AND (g.home_team_id = ? OR g.away_team_id = ?)`, [seasonId, sportId, teamId, teamId], 'g.game_date ASC, g.game_time ASC')
  }

  async getPriorMeetings(teamAId: string, teamBId: string, sportId: string, excludeId?: string | null, limit = 5) {
    let where = `g.sport_id = ? AND lower(g.status) = 'final' AND lower(coalesce(g.contest_type,'Game')) != 'scrimmage' AND ((g.home_team_id = ? AND g.away_team_id = ?) OR (g.home_team_id = ? AND g.away_team_id = ?))`
    const binds: unknown[] = [sportId, teamAId, teamBId, teamBId, teamAId]
    if (excludeId) { where += ' AND g.id != ?'; binds.push(excludeId) }
    return queryGames(this.db, where, binds, 'g.game_date DESC, g.game_time DESC', limit)
  }
}
