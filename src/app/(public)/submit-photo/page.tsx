import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'
import SubmitPhotoForm from './SubmitPhotoForm'
import { sectionXDateOffset } from '@/lib/sectionx-time'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Submit a Photo',
  description: 'Submit a sports photo for the Section X Scoreboard photo gallery.',
}

type PageProps = { searchParams?: { game?: string } }

export default async function SubmitPhotoPage({ searchParams }: PageProps) {
  const repo = getSportsRepository()
  const startExclusive = sectionXDateOffset(-46)
  const endDate = sectionXDateOffset(150)
  const [schools, allSports, games] = await Promise.all([
    repo.getSchools(),
    repo.getSports(),
    repo.getGamesBetween(startExclusive, endDate, 1200),
  ])
  const sports = allSports.filter((s:any)=>s.active_public)
  const gameOptions = games.map((game:any)=>({
    id:game.id,
    game_date:game.game_date,
    game_time:game.game_time,
    sport_id:game.sport_id,
    sport_name:game.sport?.sport_name||'Sport',
    home_team_id:game.home_team_id,
    away_team_id:game.away_team_id,
    home_school_id:game.home_team?.school?.id||null,
    away_school_id:game.away_team?.school?.id||null,
    home_name:game.home_team?.school?.school_name||game.external_home?.name||'TBD',
    away_name:game.away_team?.school?.school_name||game.external_away?.name||'TBD',
  }))

  return <PublicLayout><div className="max-w-2xl mx-auto px-4 py-6">
    <h1 className="text-3xl font-bold text-white mb-1" style={{fontFamily:'var(--font-display)'}}>Submit a Photo</h1>
    <p className="text-sm mb-6" style={{color:'var(--text-secondary)'}}>Share your Section X sports photos. If you came from a Game Center, the matchup is already selected. Otherwise, today’s games are shown first and you can search the schedule.</p>
    <SubmitPhotoForm schools={schools.map((s:any)=>({id:s.id,school_name:s.school_name}))} sports={sports} games={gameOptions} initialGameId={searchParams?.game||''}/>
  </div></PublicLayout>
}
