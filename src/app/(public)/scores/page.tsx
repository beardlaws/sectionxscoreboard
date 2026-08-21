// src/app/(public)/scores/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'
import ScoresClient from './ScoresClient'
import { format } from 'date-fns'

export const metadata: Metadata = {
  title: 'Scores',
  description: 'Section X high school sports scores and results by date.',
}
export const revalidate = 60

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: { date?: string; sport?: string; season?: string }
}) {
  const supabase = createClient()
  const today = format(new Date(), 'yyyy-MM-dd')
  const selectedDate = searchParams.date || today

  const { data: allSeasons } = await supabase
    .from('seasons').select('id, name, is_active, season_type, year')
    .order('year', { ascending: false })

  const activeSeason = (allSeasons || []).find((s: any) => s.is_active)
  const selectedSeasonId = searchParams.season || activeSeason?.id

  const { data: sponsorCandidates } = await supabase
    .from('sponsors').select('*')
    .eq('active', true)
    .or('placement_type.eq.scores,show_on_scores.eq.true')
    .order('created_at', { ascending: false })
    .limit(20)

  const scoresSponsor = (sponsorCandidates || []).find((s: any) => {
    if (s.start_date && s.start_date > today) return false
    if (s.end_date && s.end_date < today) return false
    return true
  }) || null

  const { data: games } = await supabase
    .from('games')
    .select(`*,
      sport:sports(*),
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(*),
      external_away:external_opponents!games_external_away_opponent_id_fkey(*)`)
    .eq('game_date', selectedDate)
    .order('game_time', { ascending: true })

  const { data: sports } = await supabase.from('sports').select('*').order('sport_name')

  let dateQuery = supabase.from('games').select('game_date')
    .gte('game_date', format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd'))
    .lte('game_date', format(new Date(Date.now() + 14 * 86400000), 'yyyy-MM-dd'))

  if (selectedSeasonId) {
    dateQuery = (dateQuery as any).eq('season_id', selectedSeasonId)
  }

  const { data: gameDates } = await dateQuery
  const datesWithGames = [...new Set((gameDates || []).map((g: any) => g.game_date))].sort()

  const SEASON_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    Spring: { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', border: 'rgba(34,197,94,0.25)' },
    Fall:   { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
    Winter: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 pt-4">
        {(allSeasons || []).length > 1 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-xs text-slate-500 flex-shrink-0"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
              SEASON:
            </span>
            {(allSeasons || []).map((s: any) => {
              const isSelected = searchParams.season ? s.id === searchParams.season : s.is_active
              const c = SEASON_COLORS[s.season_type || 'Spring'] || SEASON_COLORS.Spring
              return (
                <a key={s.id}
                  href={s.is_active ? '/scores' : `/scores?season=${s.id}`}
                  className="text-xs font-black px-3 py-1 rounded-full transition-all"
                  style={{
                    fontFamily: 'var(--font-display)', letterSpacing: '0.06em',
                    background: isSelected ? c.bg : 'rgba(255,255,255,0.04)',
                    color: isSelected ? c.text : '#4a5f7a',
                    border: `1px solid ${isSelected ? c.border : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  {s.name}{s.is_active ? ' ✓' : ''}
                </a>
              )
            })}
          </div>
        )}

        {scoresSponsor && (
          <a href={(scoresSponsor as any).website_url || '#'} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(8,12,20,0.8))',
              border: '1px solid rgba(37,99,235,0.2)',
            }}>
            {(scoresSponsor as any).logo_url && (
              <img src={(scoresSponsor as any).logo_url} alt={(scoresSponsor as any).business_name}
                className="w-8 h-8 object-contain rounded flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.05)' }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.1em' }}>SCORES PRESENTED BY</p>
              <p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{(scoresSponsor as any).business_name}</p>
              {(scoresSponsor as any).tagline && <p className="text-xs text-slate-400 truncate">{(scoresSponsor as any).tagline}</p>}
            </div>
            <span className="text-xs font-bold text-blue-400 flex-shrink-0" style={{ fontFamily: 'var(--font-display)' }}>Visit →</span>
          </a>
        )}
      </div>

      <ScoresClient
        games={games || []}
        sports={sports || []}
        selectedDate={selectedDate}
        today={today}
        datesWithGames={datesWithGames}
      />
    </PublicLayout>
  )
}
