import type { CrossCountryRepository } from './cross-country-repository'

function placeholders(count: number) {
  return Array.from({ length: count }, () => '?').join(',')
}

export class D1CrossCountryRepository implements CrossCountryRepository {
  constructor(private db: any) {}

  async getMeetsByDate(date: string) {
    const result = await this.db.prepare(`
      SELECT * FROM cross_country_meets
      WHERE meet_date = ?
      ORDER BY meet_name ASC
    `).bind(date).all()
    return result.results || []
  }

  async getMeetsForSeason(seasonId: string) {
    const result = await this.db.prepare(`
      SELECT * FROM cross_country_meets
      WHERE season_id = ?
      ORDER BY meet_date ASC, meet_name ASC
    `).bind(seasonId).all()
    return result.results || []
  }

  async getMeetDates(startDate: string, endDate: string) {
    const result = await this.db.prepare(`
      SELECT DISTINCT meet_date
      FROM cross_country_meets
      WHERE meet_date >= ? AND meet_date <= ?
      ORDER BY meet_date ASC
    `).bind(startDate, endDate).all()
    return (result.results || []).map((row: any) => String(row.meet_date))
  }

  async getTeamResultsForMeetIds(meetIds: string[]) {
    if (!meetIds.length) return []
    const sql = `
      SELECT
        r.*,
        s.id AS joined_sport_id,
        s.slug AS sport_slug,
        s.gender AS sport_gender,
        s.sport_name AS sport_name,
        t.id AS joined_team_id,
        t.team_name,
        t.slug AS team_slug,
        sc.id AS school_id,
        sc.school_name,
        sc.slug AS school_slug,
        sc.primary_color,
        sc.logo_url,
        eo.id AS joined_external_id,
        eo.name AS external_name,
        eo.slug AS external_slug
      FROM cross_country_team_results r
      LEFT JOIN sports s ON s.id = r.sport_id
      LEFT JOIN teams t ON t.id = r.team_id
      LEFT JOIN schools sc ON sc.id = t.school_id
      LEFT JOIN external_opponents eo ON eo.id = r.external_opponent_id
      WHERE r.meet_id IN (${placeholders(meetIds.length)})
      ORDER BY r.finish_place ASC
    `
    const result = await this.db.prepare(sql).bind(...meetIds).all()
    return (result.results || []).map((row: any) => ({
      id: row.id,
      meet_id: row.meet_id,
      sport_id: row.sport_id,
      team_id: row.team_id,
      external_opponent_id: row.external_opponent_id,
      team_score: row.team_score,
      finish_place: row.finish_place,
      is_section_x: Boolean(row.is_section_x),
      created_at: row.created_at,
      sport: row.joined_sport_id ? { id: row.joined_sport_id, slug: row.sport_slug, gender: row.sport_gender, sport_name: row.sport_name } : null,
      team: row.joined_team_id ? {
        id: row.joined_team_id,
        team_name: row.team_name,
        slug: row.team_slug,
        school: row.school_id ? { id: row.school_id, school_name: row.school_name, slug: row.school_slug, primary_color: row.primary_color, logo_url: row.logo_url } : null,
      } : null,
      external_opponent: row.joined_external_id ? { id: row.joined_external_id, name: row.external_name, slug: row.external_slug } : null,
    }))
  }

  async getTeamResultsForSport(sportId: string, meetIds?: string[]) {
    let sql = 'SELECT * FROM cross_country_team_results WHERE sport_id = ?'
    const binds: unknown[] = [sportId]
    if (meetIds?.length) {
      sql += ` AND meet_id IN (${placeholders(meetIds.length)})`
      binds.push(...meetIds)
    }
    sql += ' ORDER BY meet_id ASC, finish_place ASC'
    const result = await this.db.prepare(sql).bind(...binds).all()
    return result.results || []
  }

  async getDualResultsForMeetIds(meetIds: string[]) {
    if (!meetIds.length) return []
    const result = await this.db.prepare(`
      SELECT * FROM cross_country_dual_results
      WHERE meet_id IN (${placeholders(meetIds.length)})
      ORDER BY created_at ASC
    `).bind(...meetIds).all()
    return result.results || []
  }

  async getDualResultsForSport(sportId: string, meetIds?: string[]) {
    let sql = 'SELECT * FROM cross_country_dual_results WHERE sport_id = ?'
    const binds: unknown[] = [sportId]
    if (meetIds?.length) {
      sql += ` AND meet_id IN (${placeholders(meetIds.length)})`
      binds.push(...meetIds)
    }
    sql += ' ORDER BY created_at ASC'
    const result = await this.db.prepare(sql).bind(...binds).all()
    return result.results || []
  }
}
