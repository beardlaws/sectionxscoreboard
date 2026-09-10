import type { SportsRepository } from './sports-repository'
import { isScrimmage } from '@/lib/gameType'

function presentGame(game: any) {
  if (!game) return game
  return isScrimmage(game) ? { ...game, status: 'Scrimmage', home_score: null, away_score: null } : game
}

function mapSchoolRow(row: any) {
  if (!row) return null
  return {
    ...row,
    active: Boolean(row.active),
    is_section_x: row.is_section_x == null ? true : Boolean(row.is_section_x),
  }
}

function mapSportRow(row: any) {
  if (!row) return null
  return { ...row, active_public: Boolean(row.active_public) }
}

function mapGameRow(row: any) {
  if (!row) return null
  return presentGame({
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
      season_type: row.sport_season_type,
      slug: row.sport_slug,
      homepage_priority: row.sport_homepage_priority,
      active_public: Boolean(row.sport_active_public),
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
        is_section_x: row.home_school_is_section_x == null ? true : Boolean(row.home_school_is_section_x),
        primary_color: row.home_school_primary_color,
        secondary_color: row.home_school_secondary_color,
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
        is_section_x: row.away_school_is_section_x == null ? true : Boolean(row.away_school_is_section_x),
        primary_color: row.away_school_primary_color,
        secondary_color: row.away_school_secondary_color,
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
  })
}

const GAME_JOIN = `
  SELECT
    g.*,
    s.sport_name,
    s.gender AS sport_gender,
    s.season_type AS sport_season_type,
    s.slug AS sport_slug,
    s.homepage_priority AS sport_homepage_priority,
    s.active_public AS sport_active_public,
    ht.team_name AS home_team_name,
    ht.slug AS home_team_slug,
    ht.level AS home_team_level,
    hs.id AS home_school_id,
    hs.school_name AS home_school_name,
    hs.mascot AS home_school_mascot,
    hs.city AS home_school_city,
    hs.county AS home_school_county,
    hs.alias AS home_school_alias,
    hs.slug AS home_school_slug,
    hs.logo_url AS home_school_logo_url,
    hs.is_section_x AS home_school_is_section_x,
    hs.primary_color AS home_school_primary_color,
    hs.secondary_color AS home_school_secondary_color,
    at.team_name AS away_team_name,
    at.slug AS away_team_slug,
    at.level AS away_team_level,
    aws.id AS away_school_id,
    aws.school_name AS away_school_name,
    aws.mascot AS away_school_mascot,
    aws.city AS away_school_city,
    aws.county AS away_school_county,
    aws.alias AS away_school_alias,
    aws.slug AS away_school_slug,
    aws.logo_url AS away_school_logo_url,
    aws.is_section_x AS away_school_is_section_x,
    aws.primary_color AS away_school_primary_color,
    aws.secondary_color AS away_school_secondary_color,
    eh.name AS external_home_name,
    eh.slug AS external_home_slug,
    eh.city AS external_home_city,
    eh.state AS external_home_state,
    eh.section AS external_home_section,
    ea.name AS external_away_name,
    ea.slug AS external_away_slug,
    ea.city AS external_away_city,
    ea.state AS external_away_state,
    ea.section AS external_away_section
  FROM games g
  LEFT JOIN sports s ON s.id = g.sport_id
  LEFT JOIN teams ht ON ht.id = g.home_team_id
  LEFT JOIN schools hs ON hs.id = ht.school_id
  LEFT JOIN teams at ON at.id = g.away_team_id
  LEFT JOIN schools aws ON aws.id = at.school_id
  LEFT JOIN external_opponents eh ON eh.id = g.external_home_opponent_id
  LEFT JOIN external_opponents ea ON ea.id = g.external_away_opponent_id
`

async function queryGames(db: any, where: string, binds: unknown[] = [], order = 'g.game_date ASC, g.game_time ASC', limit?: number) {
  let sql = `${GAME_JOIN} WHERE ${where} ORDER BY ${order}`
  if (limit) sql += ` LIMIT ${limit}`
  const result = await db.prepare(sql).bind(...binds).all()
  return (result.results || []).map(mapGameRow)
}

export class D1SportsRepository implements SportsRepository {
  constructor(private db: any) {}

  async getActiveSeason() {
    return await this.db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').first()
  }

  async getSeasons() {
    const result = await this.db.prepare('SELECT * FROM seasons ORDER BY year DESC, season_type ASC').all()
    return result.results || []
  }

  async getSports() {
    const result = await this.db.prepare('SELECT * FROM sports ORDER BY sport_name ASC').all()
    return (result.results || []).map(mapSportRow)
  }

  async getSportBySlug(slug: string) {
    return mapSportRow(await this.db.prepare('SELECT * FROM sports WHERE slug = ? LIMIT 1').bind(slug).first())
  }

  async getSchools() {
    const result = await this.db.prepare('SELECT * FROM schools WHERE active = 1 ORDER BY school_name ASC').all()
    return (result.results || []).map(mapSchoolRow)
  }

  async getSchoolBySlug(slug: string) {
    return mapSchoolRow(await this.db.prepare('SELECT * FROM schools WHERE slug = ? LIMIT 1').bind(slug).first())
  }

  async getTeamsForSchool(schoolId: string, seasonId?: string | null) {
    let sql = `
      SELECT t.*, s.sport_name, s.slug AS sport_slug, s.gender AS sport_gender, s.season_type AS sport_season_type,
             ts.division, ts.class, ts.active_for_season, ts.display_team_name, ts.btm_override
      FROM teams t
      JOIN sports s ON s.id = t.sport_id
      LEFT JOIN team_seasons ts ON ts.team_id = t.id ${seasonId ? 'AND ts.season_id = ?' : ''}
      WHERE t.school_id = ? AND t.active = 1
      ORDER BY s.sport_name ASC, t.team_name ASC
    `
    const binds = seasonId ? [seasonId, schoolId] : [schoolId]
    const result = await this.db.prepare(sql).bind(...binds).all()
    return (result.results || []).map((row: any) => ({
      id: row.id,
      school_id: row.school_id,
      sport_id: row.sport_id,
      team_name: row.team_name,
      slug: row.slug,
      level: row.level,
      active: Boolean(row.active),
      division: row.division || '',
      class: row.class || '',
      display_team_name: row.display_team_name || null,
      btm_override: row.btm_override ?? null,
      sport: {
        id: row.sport_id,
        sport_name: row.sport_name,
        slug: row.sport_slug,
        gender: row.sport_gender,
        season_type: row.sport_season_type,
      },
    }))
  }

  async getTeamBySlug(slug: string) {
    const row = await this.db.prepare(`
      SELECT t.*, s.sport_name, s.slug AS sport_slug, s.gender AS sport_gender, s.season_type AS sport_season_type,
             sc.school_name, sc.mascot, sc.city, sc.county, sc.slug AS school_slug, sc.logo_url,
             sc.primary_color, sc.secondary_color, sc.is_section_x
      FROM teams t
      JOIN sports s ON s.id = t.sport_id
      JOIN schools sc ON sc.id = t.school_id
      WHERE t.slug = ? LIMIT 1
    `).bind(slug).first()
    if (!row) return null
    return {
      id: row.id, school_id: row.school_id, sport_id: row.sport_id, team_name: row.team_name,
      slug: row.slug, level: row.level, active: Boolean(row.active), created_at: row.created_at,
      sport: { id: row.sport_id, sport_name: row.sport_name, slug: row.sport_slug, gender: row.sport_gender, season_type: row.sport_season_type },
      school: { id: row.school_id, school_name: row.school_name, mascot: row.mascot, city: row.city, county: row.county, slug: row.school_slug, logo_url: row.logo_url, primary_color: row.primary_color, secondary_color: row.secondary_color, is_section_x: row.is_section_x == null ? true : Boolean(row.is_section_x) },
    }
  }

  async getTeamSeason(teamId: string, seasonId: string) {
    const row = await this.db.prepare('SELECT * FROM team_seasons WHERE team_id = ? AND season_id = ? LIMIT 1').bind(teamId, seasonId).first()
    if (!row) return null
    return { ...row, active_for_season: Boolean(row.active_for_season), is_coop: Boolean(row.is_coop) }
  }

  async getTeamSeasonsForSport(sportId: string, seasonId: string) {
    const result = await this.db.prepare(`
      SELECT ts.*, t.team_name, t.slug AS team_slug, t.sport_id, t.level, t.active,
             sc.id AS school_id, sc.school_name, sc.slug AS school_slug, sc.primary_color, sc.logo_url, sc.is_section_x
      FROM team_seasons ts
      JOIN teams t ON t.id = ts.team_id
      JOIN schools sc ON sc.id = t.school_id
      WHERE ts.season_id = ? AND t.sport_id = ? AND ts.active_for_season != 0 AND t.active = 1
      ORDER BY sc.school_name ASC
    `).bind(seasonId, sportId).all()
    return (result.results || []).map((row: any) => ({
      team_id: row.team_id,
      season_id: row.season_id,
      division: row.division,
      class: row.class,
      btm_override: row.btm_override,
      active_for_season: Boolean(row.active_for_season),
      team: {
        id: row.team_id,
        team_name: row.team_name,
        slug: row.team_slug,
        sport_id: row.sport_id,
        level: row.level,
        active: Boolean(row.active),
        school: {
          id: row.school_id,
          school_name: row.school_name,
          slug: row.school_slug,
          primary_color: row.primary_color,
          logo_url: row.logo_url,
          is_section_x: row.is_section_x == null ? true : Boolean(row.is_section_x),
        },
      },
    }))
  }

  async getGamesByDate(date: string) {
    return queryGames(this.db, 'g.game_date = ?', [date])
  }

  async getGamesBetween(startExclusive: string, endInclusive: string, limit = 160) {
    return queryGames(this.db, 'g.game_date > ? AND g.game_date <= ?', [startExclusive, endInclusive], 'g.game_date ASC, g.game_time ASC', limit)
  }

  async getGamesForSport(sportId: string, seasonId: string, startDate?: string | null, endDate?: string | null) {
    let where = 'g.sport_id = ? AND g.season_id = ?'
    const binds: unknown[] = [sportId, seasonId]
    if (startDate) { where += ' AND g.game_date >= ?'; binds.push(startDate) }
    if (endDate) { where += ' AND g.game_date <= ?'; binds.push(endDate) }
    return queryGames(this.db, where, binds, 'g.game_date DESC, g.game_time DESC')
  }

  async getFinalGamesForSport(sportId: string, seasonId: string) {
    return queryGames(this.db, "g.sport_id = ? AND g.season_id = ? AND g.status = 'Final'", [sportId, seasonId], 'g.game_date DESC, g.game_time DESC')
  }

  async getGamesForTeam(teamId: string, seasonId?: string | null) {
    let where = '(g.home_team_id = ? OR g.away_team_id = ?)'
    const binds: unknown[] = [teamId, teamId]
    if (seasonId) { where += ' AND g.season_id = ?'; binds.push(seasonId) }
    return queryGames(this.db, where, binds, 'g.game_date DESC, g.game_time DESC')
  }

  async getRecentFinals(sinceDate: string, limit = 80) {
    return queryGames(this.db, "g.status = 'Final' AND g.game_date >= ? AND lower(coalesce(g.contest_type, 'Game')) != 'scrimmage' AND lower(coalesce(g.notes, '')) NOT LIKE '%arbiter type: scrimmage%'", [sinceDate], 'g.game_date DESC, g.game_time DESC', limit)
  }

  async getFeaturedGame(date: string) {
    const rows = await queryGames(this.db, 'g.game_of_the_night = 1 AND g.game_date = ?', [date], 'g.updated_at DESC', 1)
    return rows[0] || null
  }

  async getDatesWithGames(startDate: string, endDate: string, seasonId?: string | null) {
    let sql = 'SELECT DISTINCT game_date FROM games WHERE game_date >= ? AND game_date <= ?'
    const binds: unknown[] = [startDate, endDate]
    if (seasonId) {
      sql += ' AND season_id = ?'
      binds.push(seasonId)
    }
    sql += ' ORDER BY game_date ASC'
    const result = await this.db.prepare(sql).bind(...binds).all()
    return (result.results || []).map((row: any) => String(row.game_date))
  }
}
