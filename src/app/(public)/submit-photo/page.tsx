// src/app/(public)/submit-photo/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'
import SubmitPhotoForm from './SubmitPhotoForm'

export const metadata: Metadata = {
  title: 'Submit a Photo',
  description: 'Submit a sports photo for the Section X Scoreboard photo gallery.',
}

type PageProps = {
  searchParams?: { game?: string }
}

export default async function SubmitPhotoPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const [{ data: schools }, { data: sports }, { data: games }] = await Promise.all([
    supabase.from('schools').select('id, school_name').eq('active', true).order('school_name'),
    supabase.from('sports').select('*').eq('active_public', true).order('sport_name'),
    supabase
      .from('games')
      .select(`
        id, game_date, game_time, sport_id, home_team_id, away_team_id,
        home_team:teams!games_home_team_id_fkey(id, school:schools(id, school_name)),
        away_team:teams!games_away_team_id_fkey(id, school:schools(id, school_name)),
        external_home:external_opponents!games_external_home_opponent_id_fkey(name),
        external_away:external_opponents!games_external_away_opponent_id_fkey(name)
      `)
      .order('game_date', { ascending: false })
      .limit(150),
  ])

  const gameOptions = (games || []).map((game: any) => ({
    id: game.id,
    game_date: game.game_date,
    game_time: game.game_time,
    sport_id: game.sport_id,
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
    home_school_id: game.home_team?.school?.id || null,
    away_school_id: game.away_team?.school?.id || null,
    home_name: game.home_team?.school?.school_name || game.external_home?.name || 'TBD',
    away_name: game.away_team?.school?.school_name || game.external_away?.name || 'TBD',
  }))

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Submit a Photo
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Share your Section X sports photos. Connect them to a game when possible so one approved photo can live with the game, teams, schools and sport. Photographer credit is always given.
        </p>
        <SubmitPhotoForm
          schools={schools || []}
          sports={sports || []}
          games={gameOptions}
          initialGameId={searchParams?.game || ''}
        />
      </div>
    </PublicLayout>
  )
}
