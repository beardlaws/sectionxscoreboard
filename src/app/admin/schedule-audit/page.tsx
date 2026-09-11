// src/app/admin/schedule-audit/page.tsx
import { getCloudflareContext } from '@opennextjs/cloudflare'
import AdminLayout from '@/components/layout/AdminLayout'
import ScheduleAudit from './ScheduleAudit'

export const dynamic = 'force-dynamic'

function getDb() {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

export default async function ScheduleAuditPage() {
  const db = getDb()

  const [teamsResult, sportsResult, seasonsResult, gamesResult, importSourcesResult, teamSeasonsResult] = await Promise.all([
    db.prepare(`
      SELECT
        t.id,t.team_name,t.sport_id,t.level,t.active,
        s.id AS school_id,s.school_name,s.alias,s.slug AS school_slug,s.primary_color
      FROM teams t
      LEFT JOIN schools s ON s.id=t.school_id
      ORDER BY t.id ASC
    `).all(),
    db.prepare('SELECT * FROM sports ORDER BY sport_name ASC').all(),
    db.prepare('SELECT * FROM seasons ORDER BY year DESC').all(),
    db.prepare(`
      SELECT id,season_id,sport_id,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id,
             game_date,game_time,location,status,parser_confidence,game_number
      FROM games ORDER BY id ASC
    `).all(),
    db.prepare(`
      SELECT id,game_id,team_id,season_id,sport_id,source,imported_at
      FROM game_import_sources ORDER BY id ASC
    `).all(),
    db.prepare(`
      SELECT id,team_id,season_id,active_for_season,class,division
      FROM team_seasons ORDER BY id ASC
    `).all(),
  ])

  const teams = (teamsResult.results || []).map((team: any) => ({
    id: team.id,
    team_name: team.team_name,
    sport_id: team.sport_id,
    level: team.level,
    active: Boolean(team.active),
    school: team.school_id ? {
      id: team.school_id,
      school_name: team.school_name,
      alias: team.alias,
      slug: team.school_slug,
      primary_color: team.primary_color,
    } : null,
  }))

  return (
    <AdminLayout>
      <ScheduleAudit
        teams={teams}
        sports={sportsResult.results || []}
        seasons={seasonsResult.results || []}
        games={gamesResult.results || []}
        importSources={importSourcesResult.results || []}
        teamSeasons={teamSeasonsResult.results || []}
      />
    </AdminLayout>
  )
}
