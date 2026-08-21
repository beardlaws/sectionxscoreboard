import { createClient } from '@/lib/supabase/server'
import { getGameCenterData } from '@/lib/game-center'
import { AthleteStatsTable, PeriodScoreTable, TeamStatsTable } from './GameDataModules'
import SubmitGamePhotoLink from './SubmitGamePhotoLink'

export default async function GameCenterSections({ gameId, awayName, homeName }: { gameId: string; awayName: string; homeName: string }) {
  const supabase = createClient()
  const { periodScores, teamStats, athleteStats } = await getGameCenterData(supabase, gameId)

  return (
    <>
      <PeriodScoreTable scores={periodScores as any} awayName={awayName} homeName={homeName} />
      <TeamStatsTable stats={teamStats as any} awayName={awayName} homeName={homeName} />
      <AthleteStatsTable stats={athleteStats as any} />
      <SubmitGamePhotoLink gameId={gameId} />
    </>
  )
}
