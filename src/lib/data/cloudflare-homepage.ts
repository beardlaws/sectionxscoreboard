import { getCloudflareContext } from '@opennextjs/cloudflare'
import { sectionXDate, sectionXDateOffset } from '@/lib/sectionx-time'
import { isScrimmage } from '@/lib/gameType'

function presentGame(game: any) {
  if (!game) return game
  return isScrimmage(game) ? { ...game, status: 'Scrimmage', home_score: null, away_score: null } : game
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
        slug: row.home_school_slug,
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
        slug: row.away_school_slug,
        primary_color: row.away_school_primary_color,
        secondary_color: row.away_school_secondary_color,
      } : null,
    } : null,
    external_home: row.external_home_opponent_id ? {
      id: row.external_home_opponent_id,
      name: row.external_home_name,
      slug: row.external_home_slug,
    } : null,
    external_away: row.external_away_opponent_id ? {
      id: row.external_away_opponent_id,
      name: row.external_away_name,
      slug: row.external_away_slug,
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
    ht.team_name AS home_team_name,
    ht.slug AS home_team_slug,
    ht.level AS home_team_level,
    hs.id AS home_school_id,
    hs.school_name AS home_school_name,
    hs.mascot AS home_school_mascot,
    hs.slug AS home_school_slug,
    hs.primary_color AS home_school_primary_color,
    hs.secondary_color AS home_school_secondary_color,
    at.team_name AS away_team_name,
    at.slug AS away_team_slug,
    at.level AS away_team_level,
    aws.id AS away_school_id,
    aws.school_name AS away_school_name,
    aws.mascot AS away_school_mascot,
    aws.slug AS away_school_slug,
    aws.primary_color AS away_school_primary_color,
    aws.secondary_color AS away_school_secondary_color,
    eh.name AS external_home_name,
    eh.slug AS external_home_slug,
    ea.name AS external_away_name,
    ea.slug AS external_away_slug
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

export async function getCloudflareHomepageCoreData() {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

  const today = sectionXDate()
  const yesterday = sectionXDateOffset(-1)
  const tomorrow = sectionXDateOffset(1)
  const fourteenDaysOut = sectionXDateOffset(14)
  const sevenDaysAgo = sectionXDateOffset(-7)

  const [activeSeason, yesterdayGames, todayGames, tomorrowGames, upcomingGames, recentGames, featuredGames, schoolResult] = await Promise.all([
    db.prepare('SELECT * FROM seasons WHERE is_active = 1 LIMIT 1').first(),
    queryGames(db, 'g.game_date = ?', [yesterday]),
    queryGames(db, 'g.game_date = ?', [today]),
    queryGames(db, 'g.game_date = ?', [tomorrow]),
    queryGames(db, 'g.game_date > ? AND g.game_date <= ?', [today, fourteenDaysOut], 'g.game_date ASC, g.game_time ASC', 160),
    queryGames(db, "g.status = 'Final' AND g.game_date >= ? AND lower(coalesce(g.notes, '')) NOT LIKE '%arbiter type: scrimmage%'", [sevenDaysAgo], 'g.game_date DESC, g.game_time DESC', 80),
    queryGames(db, 'g.game_of_the_night = 1 AND g.game_date = ?', [today], 'g.updated_at DESC', 1),
    db.prepare('SELECT * FROM schools WHERE active = 1 ORDER BY school_name ASC').all(),
  ])

  return {
    source: 'cloudflare-d1',
    activeSeason: activeSeason || null,
    yesterdayGames,
    todayGames,
    tomorrowGames,
    upcomingGames,
    recentGames,
    featuredGame: featuredGames[0] || null,
    schools: schoolResult.results || [],
    today,
  }
}
