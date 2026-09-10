import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { env } = getCloudflareContext()
    const db = (env as any).DB

    if (!db) {
      return Response.json({ ok: false, error: 'D1 binding DB is unavailable' }, { status: 500 })
    }

    const counts: Record<string, number> = {}
    for (const table of ['schools', 'sports', 'seasons', 'external_opponents', 'teams', 'team_seasons', 'games']) {
      const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first()
      counts[table] = Number(row?.count || 0)
    }

    const activeSeason = await db
      .prepare('SELECT id, name, year, season_type FROM seasons WHERE is_active = 1 LIMIT 1')
      .first()

    const sampleGames = await db.prepare(`
      SELECT
        g.id,
        g.game_date,
        g.game_time,
        g.status,
        g.home_score,
        g.away_score,
        hs.school_name AS home_school,
        asch.school_name AS away_school,
        eh.name AS external_home,
        ea.name AS external_away,
        s.sport_name
      FROM games g
      LEFT JOIN teams ht ON ht.id = g.home_team_id
      LEFT JOIN schools hs ON hs.id = ht.school_id
      LEFT JOIN teams at ON at.id = g.away_team_id
      LEFT JOIN schools asch ON asch.id = at.school_id
      LEFT JOIN external_opponents eh ON eh.id = g.external_home_opponent_id
      LEFT JOIN external_opponents ea ON ea.id = g.external_away_opponent_id
      LEFT JOIN sports s ON s.id = g.sport_id
      ORDER BY g.game_date DESC, g.game_time DESC
      LIMIT 5
    `).all()

    return Response.json({
      ok: true,
      source: 'cloudflare-d1',
      counts,
      activeSeason: activeSeason || null,
      sampleGames: sampleGames.results || [],
    })
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
