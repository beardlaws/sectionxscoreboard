import { notFound } from 'next/navigation'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import AdminLayout from '@/components/layout/AdminLayout'
import GameCenterEditor from './GameCenterEditor'
import CleanupGameButton from './CleanupGameButton'

export const dynamic = 'force-dynamic'
type PageProps = { params: { id: string } }

export default async function AdminGameCenterPage({ params }: PageProps) {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

  const raw: any = await db.prepare(`
    SELECT g.id,g.game_date,g.game_time,g.status,g.home_score,g.away_score,g.sport_id,g.season_id,
      g.home_team_id,g.away_team_id,g.recap,g.recap_author,g.source,
      sp.id AS sport__id,sp.sport_name AS sport__sport_name,sp.gender AS sport__gender,
      se.id AS season__id,se.name AS season__name,
      ht.id AS home__id,ht.team_name AS home__team_name,hs.id AS home_school__id,hs.school_name AS home_school__name,hs.logo_url AS home_school__logo,hs.primary_color AS home_school__color,
      at.id AS away__id,at.team_name AS away__team_name,aschool.id AS away_school__id,aschool.school_name AS away_school__name,aschool.logo_url AS away_school__logo,aschool.primary_color AS away_school__color,
      eh.name AS external_home__name,ea.name AS external_away__name
    FROM games g
    LEFT JOIN sports sp ON sp.id=g.sport_id
    LEFT JOIN seasons se ON se.id=g.season_id
    LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN schools hs ON hs.id=ht.school_id
    LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN schools aschool ON aschool.id=at.school_id
    LEFT JOIN external_opponents eh ON eh.id=g.external_home_opponent_id
    LEFT JOIN external_opponents ea ON ea.id=g.external_away_opponent_id
    WHERE g.id=? LIMIT 1`).bind(params.id).first()

  if (!raw) notFound()

  const game: any = {
    id: raw.id, game_date: raw.game_date, game_time: raw.game_time, status: raw.status,
    home_score: raw.home_score, away_score: raw.away_score, sport_id: raw.sport_id, season_id: raw.season_id,
    home_team_id: raw.home_team_id, away_team_id: raw.away_team_id, recap: raw.recap, recap_author: raw.recap_author, source: raw.source,
    sport: raw.sport__id ? { id: raw.sport__id, sport_name: raw.sport__sport_name, gender: raw.sport__gender } : null,
    season: raw.season__id ? { id: raw.season__id, name: raw.season__name } : null,
    home_team: raw.home__id ? { id: raw.home__id, team_name: raw.home__team_name, school: raw.home_school__id ? { id: raw.home_school__id, school_name: raw.home_school__name, logo_url: raw.home_school__logo, primary_color: raw.home_school__color } : null } : null,
    away_team: raw.away__id ? { id: raw.away__id, team_name: raw.away__team_name, school: raw.away_school__id ? { id: raw.away_school__id, school_name: raw.away_school__name, logo_url: raw.away_school__logo, primary_color: raw.away_school__color } : null } : null,
    external_home: raw.external_home__name ? { name: raw.external_home__name } : null,
    external_away: raw.external_away__name ? { name: raw.external_away__name } : null,
  }

  const rosterQuery = (teamId: string | null) => teamId
    ? db.prepare(`SELECT r.athlete_id,r.jersey_number,r.position,a.id AS athlete__id,a.display_name AS athlete__display_name,a.slug AS athlete__slug
        FROM roster_entries r JOIN athletes a ON a.id=r.athlete_id
        WHERE r.team_id=? AND r.season_id=? AND r.active=1 ORDER BY r.jersey_number`).bind(teamId, game.season_id).all()
    : Promise.resolve({ results: [] })

  const [periods, teamStats, athleteStats, statDefs, homeRosterRaw, awayRosterRaw] = await Promise.all([
    db.prepare('SELECT * FROM game_period_scores WHERE game_id=? ORDER BY period_number').bind(params.id).all(),
    db.prepare('SELECT * FROM game_team_stats WHERE game_id=?').bind(params.id).all(),
    db.prepare('SELECT * FROM game_athlete_stats WHERE game_id=?').bind(params.id).all(),
    db.prepare('SELECT * FROM stat_definitions WHERE sport_id=? AND active=1 ORDER BY sort_order').bind(game.sport_id).all(),
    rosterQuery(game.home_team_id),
    rosterQuery(game.away_team_id),
  ])

  const shapeRoster = (rows: any[]) => rows.map(r => ({
    athlete_id: r.athlete_id,
    jersey_number: r.jersey_number,
    position: r.position,
    athlete: { id: r.athlete__id, display_name: r.athlete__display_name, slug: r.athlete__slug },
  }))

  const homeName = game.home_team?.school?.school_name || game.external_home?.name || 'Home'
  const awayName = game.away_team?.school?.school_name || game.external_away?.name || 'Away'

  return (
    <AdminLayout>
      <GameCenterEditor
        game={game}
        periods={(periods.results || []) as any[]}
        teamStats={(teamStats.results || []) as any[]}
        athleteStats={(athleteStats.results || []) as any[]}
        statDefinitions={(statDefs.results || []) as any[]}
        homeRoster={shapeRoster((homeRosterRaw as any).results || [])}
        awayRoster={shapeRoster((awayRosterRaw as any).results || [])}
      />
      <div className="max-w-7xl mx-auto px-4 md:px-6 pb-8">
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white">Danger Zone</div>
            <div className="text-xs text-slate-500 mt-1">Use this for test games or true deletions. It removes the game, all Game Center stats/scoring, linked photo records, and the actual stored photo files.</div>
          </div>
          <CleanupGameButton gameId={game.id} label={`${awayName} at ${homeName}`} />
        </div>
      </div>
    </AdminLayout>
  )
}
