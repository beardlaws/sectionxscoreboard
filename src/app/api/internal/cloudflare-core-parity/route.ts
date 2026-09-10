import { getRuntimeSportsRepository } from '@/lib/data/runtime-sports-repository'
import { sectionXDate } from '@/lib/sectionx-time'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const repo = await getRuntimeSportsRepository()
    const today = sectionXDate()
    const [season, schools, sports, games] = await Promise.all([
      repo.getActiveSeason(),
      repo.getSchools(),
      repo.getSports(),
      repo.getGamesByDate(today),
    ])

    const sampleSchool = schools[0] || null
    const sampleSport = sports.find((sport: any) => sport.active_public) || sports[0] || null
    const [schoolTeams, sportTeams, sportGames] = await Promise.all([
      sampleSchool ? repo.getTeamsForSchool(sampleSchool.id, season?.id || null) : Promise.resolve([]),
      sampleSport && season ? repo.getTeamSeasonsForSport(sampleSport.id, season.id) : Promise.resolve([]),
      sampleSport && season ? repo.getGamesForSport(sampleSport.id, season.id) : Promise.resolve([]),
    ])

    return Response.json({
      ok: true,
      source: 'cloudflare-d1',
      today,
      activeSeason: season,
      counts: {
        schools: schools.length,
        sports: sports.length,
        todayGames: games.length,
        sampleSchoolTeams: schoolTeams.length,
        sampleSportTeams: sportTeams.length,
        sampleSportGames: sportGames.length,
      },
      sampleSchool: sampleSchool ? { id: sampleSchool.id, slug: sampleSchool.slug, name: sampleSchool.school_name } : null,
      sampleSport: sampleSport ? { id: sampleSport.id, slug: sampleSport.slug, name: sampleSport.sport_name } : null,
      sampleGame: games[0] || null,
    })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
