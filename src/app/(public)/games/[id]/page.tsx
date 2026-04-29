// src/app/(public)/games/[id]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'
import { format, parseISO } from 'date-fns'
import { STATUS_COLORS } from '@/lib/constants'
import CorrectionForm from './CorrectionForm'

export const revalidate = 60

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createClient()
  const { data: game } = await supabase
    .from('games')
    .select(`
      *,
      sport:sports(*),
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*))
    `)
    .eq('id', params.id)
    .single()

  if (!game) return { title: 'Game Not Found' }

  const home = game.home_team?.school?.school_name || 'Home'
  const away = game.away_team?.school?.school_name || 'Away'
  const sport = game.sport?.sport_name || 'Sports'
  const date = format(parseISO(game.game_date + 'T12:00:00'), 'M/d/yyyy')

  const title = game.status === 'Final'
    ? `${away} ${game.away_score}, ${home} ${game.home_score} - ${sport} ${date}`
    : `${away} at ${home} - ${sport} ${date}`

  return {
    title,
    description: `Section X ${sport} game - ${away} at ${home} on ${date}. ${game.status === 'Final' ? `Final score: ${away} ${game.away_score}, ${home} ${game.home_score}.` : ''}`,
  }
}

export default async function GamePage({ params }: PageProps) {
  const supabase = createClient()

  const { data: game, error } = await supabase
    .from('games')
    .select(`
      *,
      sport:sports(*),
      season:seasons(*),
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(*),
      external_away:external_opponents!games_external_away_opponent_id_fkey(*)
    `)
    .eq('id', params.id)
    .single()

  if (!game || error) notFound()

  const homeTeam = game.home_team
  const awayTeam = game.away_team
  const homeSchool = homeTeam?.school
  const awaySchool = awayTeam?.school

  const homeName = homeSchool?.school_name || game.external_home?.name || 'TBD'
  const awayName = awaySchool?.school_name || game.external_away?.name || 'TBD'

  const isFinal = game.status === 'Final'
  const homeWins = isFinal && game.home_score !== null && game.away_score !== null && game.home_score > game.away_score
  const awayWins = isFinal && game.home_score !== null && game.away_score !== null && game.away_score > game.home_score

  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('game_id', game.id)
    .eq('approved', true)

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          <Link href="/scores" className="hover:text-white">Scores</Link>
          <span>/</span>
          <Link href={`/scores?date=${game.game_date}`} className="hover:text-white">
            {format(parseISO(game.game_date + 'T12:00:00'), 'M/d/yyyy')}
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-secondary)' }}>{game.sport?.sport_name}</span>
        </nav>

        {/* Main card */}
        <div className="card p-6 mb-4">
          {/* Sport / date / badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              {game.sport?.sport_name} · {format(parseISO(game.game_date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
              {game.game_time && ` · ${game.game_time}`}
            </span>
            <span className={`badge ${game.status === 'Final' ? 'badge-final' : game.status === 'Live' ? 'badge-live' : game.status === 'Scheduled' ? 'badge-scheduled' : game.status === 'Postponed' ? 'badge-postponed' : 'badge-canceled'}`}>
              {game.status}
            </span>
            {game.game_of_the_night && (
              <span className="badge" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                ⭐ Game of the Night
              </span>
            )}
            {game.verification_status === 'Official' && (
              <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                ✓ Official
              </span>
            )}
            {game.neutral_site && <span className="badge badge-scheduled">Neutral Site</span>}
          </div>

          {/* Score display */}
          <div className="space-y-4">
            {/* Away */}
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white text-lg flex-shrink-0"
                style={{ background: awaySchool?.primary_color || 'var(--bg-elevated)', fontFamily: 'var(--font-display)' }}
              >
                {(awaySchool?.alias || awayName).slice(0, 3).toUpperCase()}
              </div>
              <div className="flex-1">
                <Link
                  href={awaySchool ? `/schools/${awaySchool.slug}` : '#'}
                  className={`text-xl font-bold hover:text-blue-400 transition-colors ${awayWins ? '' : 'opacity-70'}`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {awayName}
                </Link>
                {awayTeam && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Away · {awaySchool?.city}
                  </div>
                )}
              </div>
              {(isFinal || game.status === 'Live') && (
                <span
                  className={`score-digit text-4xl font-bold ${awayWins ? 'text-white' : 'opacity-50'}`}
                >
                  {game.away_score ?? '-'}
                </span>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)' }} />

            {/* Home */}
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-white text-lg flex-shrink-0"
                style={{ background: homeSchool?.primary_color || 'var(--bg-elevated)', fontFamily: 'var(--font-display)' }}
              >
                {(homeSchool?.alias || homeName).slice(0, 3).toUpperCase()}
              </div>
              <div className="flex-1">
                <Link
                  href={homeSchool ? `/schools/${homeSchool.slug}` : '#'}
                  className={`text-xl font-bold hover:text-blue-400 transition-colors ${homeWins ? '' : 'opacity-70'}`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {homeName}
                </Link>
                {homeTeam && (
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Home · {homeSchool?.city}
                  </div>
                )}
              </div>
              {(isFinal || game.status === 'Live') && (
                <span
                  className={`score-digit text-4xl font-bold ${homeWins ? 'text-white' : 'opacity-50'}`}
                >
                  {game.home_score ?? '-'}
                </span>
              )}
            </div>
          </div>

          {/* Game details */}
          {(game.location || game.notes || game.event_name || game.rescheduled_date) && (
            <div className="mt-5 pt-4 grid grid-cols-2 gap-3 text-sm" style={{ borderTop: '1px solid var(--border)' }}>
              {game.location && (
                <div>
                  <div className="section-label mb-1">Location</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{game.location}</div>
                </div>
              )}
              {game.event_name && (
                <div>
                  <div className="section-label mb-1">Event</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{game.event_name}</div>
                </div>
              )}
              {game.rescheduled_date && (
                <div>
                  <div className="section-label mb-1">Rescheduled To</div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {format(parseISO(game.rescheduled_date + 'T12:00:00'), 'M/d/yyyy')}
                  </div>
                </div>
              )}
              {game.season && (
                <div>
                  <div className="section-label mb-1">Season</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{game.season.name}</div>
                </div>
              )}
              {game.notes && (
                <div className="col-span-2">
                  <div className="section-label mb-1">Notes</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{game.notes}</div>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Source: {game.source}</span>
            <span>Updated: {format(new Date(game.updated_at), 'M/d/yy h:mm a')}</span>
          </div>
        </div>

        {/* Photos */}
        {photos && photos.length > 0 && (
          <div className="mb-4">
            <h2 className="section-label mb-3">Game Photos</h2>
            <div className="grid grid-cols-2 gap-2">
              {photos.map(photo => (
                <div key={photo.id} className="card overflow-hidden">
                  <img src={photo.photo_url} alt={photo.caption || 'Game photo'} className="w-full aspect-video object-cover" />
                  <div className="p-2">
                    {photo.caption && <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{photo.caption}</p>}
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>📷 {photo.photographer_credit_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Report correction */}
        <CorrectionForm gameId={game.id} />
      </div>
    </PublicLayout>
  )
}
