import type { PublicContentRepository } from './public-content-repository'

function boolify(row: any, fields: string[]) {
  if (!row) return row
  const out = { ...row }
  for (const field of fields) out[field] = Boolean(out[field])
  return out
}

export class D1PublicContentRepository implements PublicContentRepository {
  constructor(private db: any) {}

  async getHomepageSponsor(today: string) {
    const row = await this.db.prepare(`
      SELECT * FROM sponsors
      WHERE active = 1
        AND placement_type = 'homepage'
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(today, today).first()
    return boolify(row, ['active','show_on_scores'])
  }

  async getScoresSponsor(today: string) {
    const row = await this.db.prepare(`
      SELECT * FROM sponsors
      WHERE active = 1
        AND (placement_type = 'scores' OR show_on_scores = 1)
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(today, today).first()
    return boolify(row, ['active','show_on_scores'])
  }

  async getFeaturedSpotlight() {
    const row = await this.db.prepare(`SELECT * FROM spotlights WHERE published = 1 AND featured = 1 ORDER BY created_at DESC LIMIT 1`).first()
    return boolify(row, ['published','featured'])
  }

  async getSpotlights(limit = 8) {
    const result = await this.db.prepare(`SELECT * FROM spotlights WHERE published = 1 ORDER BY created_at DESC LIMIT ?`).bind(limit).all()
    return (result.results || []).map((row:any)=>boolify(row,['published','featured']))
  }

  async getFeaturedAthlete() {
    const row = await this.db.prepare(`
      SELECT a.*, s.school_name, s.mascot, s.slug AS school_slug, s.primary_color, s.secondary_color
      FROM athlete_of_week a
      LEFT JOIN schools s ON s.id = a.school_id
      WHERE a.published = 1
      ORDER BY a.week_of DESC, a.created_at DESC
      LIMIT 1
    `).first()
    if (!row) return null
    return {
      ...boolify(row,['published']),
      school: row.school_id ? {
        id: row.school_id,
        school_name: row.school_name,
        mascot: row.mascot,
        slug: row.school_slug,
        primary_color: row.primary_color,
        secondary_color: row.secondary_color,
      } : null,
    }
  }

  async getHomepagePhotos(limit = 12) {
    const result = await this.db.prepare(`
      SELECT p.*, s.school_name, s.slug AS school_slug, s.primary_color,
             t.team_name, t.slug AS team_slug,
             sp.sport_name, sp.slug AS sport_slug
      FROM photos p
      LEFT JOIN schools s ON s.id = p.school_id
      LEFT JOIN teams t ON t.id = p.team_id
      LEFT JOIN sports sp ON sp.id = p.sport_id
      WHERE p.approved = 1
      ORDER BY p.featured DESC, p.created_at DESC
      LIMIT ?
    `).bind(limit).all()
    return (result.results || []).map((row:any)=>({
      ...boolify(row,['permission_confirmed','approved','featured','tag_reviewed']),
      school: row.school_id ? { id:row.school_id, school_name:row.school_name, slug:row.school_slug, primary_color:row.primary_color } : null,
      team: row.team_id ? { id:row.team_id, team_name:row.team_name, slug:row.team_slug } : null,
      sport: row.sport_id ? { id:row.sport_id, sport_name:row.sport_name, slug:row.sport_slug } : null,
    }))
  }

  async getLatestWeeklyRecap() {
    const row = await this.db.prepare(`SELECT * FROM weekly_recaps WHERE published = 1 ORDER BY published_date DESC, created_at DESC LIMIT 1`).first()
    return boolify(row,['published','featured'])
  }

  async getTeamRoster(teamId: string, seasonId: string) {
    const result = await this.db.prepare(`
      SELECT r.*, a.first_name, a.last_name, a.display_name, a.slug AS athlete_slug
      FROM roster_entries r
      JOIN athletes a ON a.id = r.athlete_id
      WHERE r.team_id = ? AND r.season_id = ? AND r.active = 1 AND a.active = 1
      ORDER BY CASE
        WHEN r.class_year = 'Senior' THEN 1 WHEN r.class_year = 'Junior' THEN 2
        WHEN r.class_year = 'Sophomore' THEN 3 WHEN r.class_year = 'Freshman' THEN 4
        WHEN r.class_year = '8th Grade' THEN 5 WHEN r.class_year = '7th Grade' THEN 6 ELSE 99 END,
        a.display_name ASC
    `).bind(teamId, seasonId).all()
    return (result.results || []).map((row:any)=>({
      ...boolify(row,['captain','active']),
      athlete:{ id:row.athlete_id, first_name:row.first_name, last_name:row.last_name, display_name:row.display_name, slug:row.athlete_slug }
    }))
  }

  async getTeamCoaches(teamId: string, seasonId: string) {
    const result = await this.db.prepare(`
      SELECT tc.*, c.first_name, c.last_name, c.display_name, c.slug AS coach_slug
      FROM team_coaches tc
      JOIN coaches c ON c.id = tc.coach_id
      WHERE tc.team_id = ? AND tc.season_id = ? AND tc.active = 1 AND c.active = 1
      ORDER BY CASE WHEN lower(coalesce(tc.title,'')) LIKE '%head%' THEN 0 ELSE 1 END, c.display_name ASC
    `).bind(teamId, seasonId).all()
    return (result.results || []).map((row:any)=>({
      ...boolify(row,['active']),
      coach:{ id:row.coach_id, first_name:row.first_name, last_name:row.last_name, display_name:row.display_name, slug:row.coach_slug }
    }))
  }
}
