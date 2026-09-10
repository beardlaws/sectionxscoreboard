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
    const row = await this.db.prepare(`SELECT * FROM sponsors WHERE active = 1 AND placement_type = 'homepage' AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?) ORDER BY created_at DESC LIMIT 1`).bind(today, today).first()
    return boolify(row, ['active','show_on_scores'])
  }

  async getScoresSponsor(today: string) {
    const row = await this.db.prepare(`SELECT * FROM sponsors WHERE active = 1 AND (placement_type = 'scores' OR show_on_scores = 1) AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?) ORDER BY created_at DESC LIMIT 1`).bind(today, today).first()
    return boolify(row, ['active','show_on_scores'])
  }

  async getSportSponsor(sportId: string, today: string) {
    const row = await this.db.prepare(`SELECT * FROM sponsors WHERE active = 1 AND placement_type = 'sport' AND sport_id = ? AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?) ORDER BY created_at DESC LIMIT 1`).bind(sportId, today, today).first()
    return boolify(row, ['active','show_on_scores'])
  }

  async getSchoolSponsor(schoolId: string, today: string) {
    const row = await this.db.prepare(`SELECT * FROM sponsors WHERE active = 1 AND placement_type = 'school' AND school_id = ? AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?) ORDER BY created_at DESC LIMIT 1`).bind(schoolId, today, today).first()
    return boolify(row, ['active','show_on_scores'])
  }

  async getFeaturedSpotlight() {
    return boolify(await this.db.prepare(`SELECT * FROM spotlights WHERE published = 1 AND featured = 1 ORDER BY created_at DESC LIMIT 1`).first(), ['published','featured'])
  }

  async getSpotlights(limit = 8) {
    const result = await this.db.prepare(`SELECT * FROM spotlights WHERE published = 1 ORDER BY created_at DESC LIMIT ?`).bind(limit).all()
    return (result.results || []).map((row:any)=>boolify(row,['published','featured']))
  }

  async getFeaturedAthlete() {
    const row = await this.db.prepare(`SELECT a.*, s.school_name, s.mascot, s.slug AS school_slug, s.primary_color, s.secondary_color FROM athlete_of_week a LEFT JOIN schools s ON s.id = a.school_id WHERE a.published = 1 ORDER BY a.week_of DESC, a.created_at DESC LIMIT 1`).first()
    if (!row) return null
    return { ...boolify(row,['published']), school: row.school_id ? { id:row.school_id, school_name:row.school_name, mascot:row.mascot, slug:row.school_slug, primary_color:row.primary_color, secondary_color:row.secondary_color } : null }
  }

  async getHomepagePhotos(limit = 12) {
    const result = await this.db.prepare(`SELECT p.*, s.school_name, s.slug AS school_slug, s.primary_color, t.team_name, t.slug AS team_slug, sp.sport_name, sp.slug AS sport_slug FROM photos p LEFT JOIN schools s ON s.id = p.school_id LEFT JOIN teams t ON t.id = p.team_id LEFT JOIN sports sp ON sp.id = p.sport_id WHERE p.approved = 1 ORDER BY p.featured DESC, p.created_at DESC LIMIT ?`).bind(limit).all()
    return (result.results || []).map((row:any)=>({ ...boolify(row,['permission_confirmed','approved','featured','tag_reviewed']), school:row.school_id?{id:row.school_id,school_name:row.school_name,slug:row.school_slug,primary_color:row.primary_color}:null, team:row.team_id?{id:row.team_id,team_name:row.team_name,slug:row.team_slug}:null, sport:row.sport_id?{id:row.sport_id,sport_name:row.sport_name,slug:row.sport_slug}:null }))
  }

  async getLatestWeeklyRecap() {
    return boolify(await this.db.prepare(`SELECT * FROM weekly_recaps WHERE published = 1 ORDER BY published_date DESC, created_at DESC LIMIT 1`).first(),['published','featured'])
  }

  async getTeamRoster(teamId: string, seasonId: string) {
    const result = await this.db.prepare(`SELECT r.*, a.first_name, a.last_name, a.display_name, a.slug AS athlete_slug FROM roster_entries r JOIN athletes a ON a.id = r.athlete_id WHERE r.team_id = ? AND r.season_id = ? AND r.active = 1 AND a.active = 1 ORDER BY CASE WHEN r.class_year = 'Senior' THEN 1 WHEN r.class_year = 'Junior' THEN 2 WHEN r.class_year = 'Sophomore' THEN 3 WHEN r.class_year = 'Freshman' THEN 4 WHEN r.class_year = '8th Grade' THEN 5 WHEN r.class_year = '7th Grade' THEN 6 ELSE 99 END, a.display_name ASC`).bind(teamId, seasonId).all()
    return (result.results || []).map((row:any)=>({ ...boolify(row,['captain','active']), athlete:{id:row.athlete_id,first_name:row.first_name,last_name:row.last_name,display_name:row.display_name,slug:row.athlete_slug} }))
  }

  async getTeamCoaches(teamId: string, seasonId: string) {
    const result = await this.db.prepare(`SELECT tc.*, c.first_name, c.last_name, c.display_name, c.slug AS coach_slug FROM team_coaches tc JOIN coaches c ON c.id = tc.coach_id WHERE tc.team_id = ? AND tc.season_id = ? AND tc.active = 1 AND c.active = 1 ORDER BY CASE WHEN lower(coalesce(tc.title,'')) LIKE '%head%' THEN 0 ELSE 1 END, c.display_name ASC`).bind(teamId, seasonId).all()
    return (result.results || []).map((row:any)=>({ ...boolify(row,['active']), coach:{id:row.coach_id,first_name:row.first_name,last_name:row.last_name,display_name:row.display_name,slug:row.coach_slug} }))
  }

  async getAthleteBySlug(slug: string) {
    const row = await this.db.prepare(`SELECT a.*, s.school_name, s.mascot, s.slug AS school_slug, s.city, s.county, s.primary_color, s.secondary_color, s.logo_url FROM athletes a LEFT JOIN schools s ON s.id = a.school_id WHERE a.slug = ? LIMIT 1`).bind(slug).first()
    if (!row) return null
    return { ...boolify(row,['active']), school:row.school_id?{id:row.school_id,school_name:row.school_name,mascot:row.mascot,slug:row.school_slug,city:row.city,county:row.county,primary_color:row.primary_color,secondary_color:row.secondary_color,logo_url:row.logo_url}:null }
  }

  async getAthleteMemberships(athleteId: string) {
    const result = await this.db.prepare(`SELECT r.*, t.team_name, t.slug AS team_slug, sp.id AS sport_id, sp.sport_name, sp.gender, sp.slug AS sport_slug, sp.season_type AS sport_season_type, se.id AS joined_season_id, se.name AS season_name, se.year AS season_year, se.season_type AS season_type, se.is_active AS season_is_active FROM roster_entries r JOIN teams t ON t.id=r.team_id JOIN sports sp ON sp.id=t.sport_id JOIN seasons se ON se.id=r.season_id WHERE r.athlete_id=? ORDER BY se.year DESC, sp.sport_name ASC`).bind(athleteId).all()
    return (result.results||[]).map((r:any)=>({ ...boolify(r,['active','captain']), team:{id:r.team_id,team_name:r.team_name,slug:r.team_slug}, sport:{id:r.sport_id,sport_name:r.sport_name,gender:r.gender,slug:r.sport_slug,season_type:r.sport_season_type}, season:{id:r.joined_season_id,name:r.season_name,year:r.season_year,season_type:r.season_type,is_active:Boolean(r.season_is_active)} }))
  }

  async getAthletePhotos(athleteId: string) {
    const result = await this.db.prepare(`SELECT p.* FROM photo_athletes pa JOIN photos p ON p.id=pa.photo_id WHERE pa.athlete_id=? AND p.approved=1 ORDER BY p.created_at DESC`).bind(athleteId).all()
    return (result.results||[]).map((r:any)=>boolify(r,['approved','featured','permission_confirmed','tag_reviewed']))
  }

  async getAthleteStats(athleteId: string) {
    const result = await this.db.prepare(`SELECT gas.*, sd.stat_key, sd.label, sd.unit, sd.sort_order, sd.sport_id AS stat_sport_id, g.game_date, g.status AS game_status, g.season_id, g.sport_id AS game_sport_id, g.home_score, g.away_score, g.home_team_id, g.away_team_id, sp.sport_name, sp.gender, se.name AS season_name, se.is_active AS season_is_active FROM game_athlete_stats gas JOIN stat_definitions sd ON sd.id=gas.stat_definition_id JOIN games g ON g.id=gas.game_id LEFT JOIN sports sp ON sp.id=g.sport_id LEFT JOIN seasons se ON se.id=g.season_id WHERE gas.athlete_id=? ORDER BY gas.created_at DESC`).bind(athleteId).all()
    return (result.results||[]).map((r:any)=>({ ...boolify(r,['verified']), stat_definition:{id:r.stat_definition_id,stat_key:r.stat_key,label:r.label,unit:r.unit,sort_order:r.sort_order,sport_id:r.stat_sport_id}, game:{id:r.game_id,game_date:r.game_date,status:r.game_status,season_id:r.season_id,sport_id:r.game_sport_id,home_score:r.home_score,away_score:r.away_score,home_team_id:r.home_team_id,away_team_id:r.away_team_id,sport:r.game_sport_id?{id:r.game_sport_id,sport_name:r.sport_name,gender:r.gender}:null,season:r.season_id?{id:r.season_id,name:r.season_name,is_active:Boolean(r.season_is_active)}:null} }))
  }
}
