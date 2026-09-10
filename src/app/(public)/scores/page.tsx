// src/app/(public)/scores/page.tsx
import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'
import ScoresClient from './ScoresClient'
import { sectionXDate, sectionXDateOffset } from '@/lib/sectionx-time'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import { getCrossCountryRepository } from '@/lib/data/runtime-cross-country-repository'

export const metadata: Metadata = {
  title: 'Scores',
  description: 'Section X high school sports scores and results by date.',
}
export const dynamic = 'force-dynamic'

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sport?: string; season?: string }>
}) {
  const params = await searchParams
  const repo = getSportsRepository()
  const xcRepo = getCrossCountryRepository()
  const today = sectionXDate()
  const selectedDate = params.date || today

  const [allSeasons, sports] = await Promise.all([
    repo.getSeasons(),
    repo.getSports(),
  ])

  const activeSeason = (allSeasons || []).find((s: any) => s.is_active)
  const selectedSeasonId = params.season || activeSeason?.id || null
  const startDate = sectionXDateOffset(-30)
  const endDate = sectionXDateOffset(14)

  const [games, gameDates, xcMeets, xcDates] = await Promise.all([
    repo.getGamesByDate(selectedDate),
    repo.getDatesWithGames(startDate, endDate, selectedSeasonId),
    xcRepo.getMeetsByDate(selectedDate),
    xcRepo.getMeetDates(startDate, endDate),
  ])

  const meetIds = xcMeets.map((meet: any) => String(meet.id))
  const xcResults = await xcRepo.getTeamResultsForMeetIds(meetIds)
  const crossCountryMeets = xcMeets.map((meet: any) => ({
    ...meet,
    results: xcResults.filter((result: any) => result.meet_id === meet.id),
  }))

  const datesWithGames = [...new Set([...gameDates, ...xcDates])].sort()

  // Sponsor inventory migrates in a later pass. Keep preview explicit instead of
  // silently reading that remaining feature from Supabase.
  const scoresSponsor = null

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
            <span className="text-xs text-slate-500 flex-shrink-0" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>SEASON:</span>
            {(allSeasons || []).map((s: any) => {
              const isSelected = params.season ? s.id === params.season : Boolean(s.is_active)
              const c = SEASON_COLORS[s.season_type || 'Spring'] || SEASON_COLORS.Spring
              return <a key={s.id} href={s.is_active ? '/scores' : `/scores?season=${s.id}`} className="text-xs font-black px-3 py-1 rounded-full transition-all" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em', background: isSelected ? c.bg : 'rgba(255,255,255,0.04)', color: isSelected ? c.text : '#4a5f7a', border: `1px solid ${isSelected ? c.border : 'rgba(255,255,255,0.06)'}` }}>{s.name}{s.is_active ? ' ✓' : ''}</a>
            })}
          </div>
        )}
        {scoresSponsor && <div />}
      </div>
      <ScoresClient games={games || []} crossCountryMeets={crossCountryMeets} sports={sports || []} selectedDate={selectedDate} today={today} datesWithGames={datesWithGames} />
    </PublicLayout>
  )
}
