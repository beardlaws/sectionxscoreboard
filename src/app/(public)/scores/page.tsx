// src/app/(public)/scores/page.tsx
import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'
import ScoresClient from './ScoresClient'
import { sectionXDate, sectionXDateOffset } from '@/lib/sectionx-time'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import { getCrossCountryRepository } from '@/lib/data/runtime-cross-country-repository'
import { getPublicContentRepository } from '@/lib/data/runtime-public-content-repository'

export const metadata: Metadata = {
  title: 'Scores',
  description: 'Section X high school sports scores and results by date.',
}
export const dynamic = 'force-dynamic'

function normalizeDateOnly(value: unknown): string | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null

  const isoPrefix = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoPrefix) return isoPrefix[1]

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function normalizeDateList(values: unknown[]) {
  return values
    .map(normalizeDateOnly)
    .filter((value): value is string => Boolean(value))
}

export default async function ScoresPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sport?: string; season?: string }>
}) {
  const params = await searchParams
  const repo = getSportsRepository()
  const xcRepo = getCrossCountryRepository()
  const contentRepo = getPublicContentRepository()
  const today = sectionXDate()
  const selectedDate = normalizeDateOnly(params.date) || today

  const [allSeasons, sports, scoresSponsor] = await Promise.all([
    repo.getSeasons(),
    repo.getSports(),
    contentRepo.getScoresSponsor(today),
  ])

  const activeSeason = (allSeasons || []).find((s: any) => s.is_active)
  const selectedSeasonId = params.season || activeSeason?.id || null
  const startDate = sectionXDateOffset(-30)
  const endDate = sectionXDateOffset(14)

  const [games, gameDatesRaw, xcMeets, xcDatesRaw] = await Promise.all([
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

  const gameDates = normalizeDateList(gameDatesRaw || [])
  const xcDates = normalizeDateList(xcDatesRaw || [])
  const datesWithGames = [...new Set([...gameDates, ...xcDates])].sort()

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
        {scoresSponsor && <a href={scoresSponsor.website_url || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-4 py-3 mb-4 transition-all hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(8,12,20,0.8))', border: '1px solid rgba(37,99,235,0.2)' }}>{scoresSponsor.logo_url && <img src={scoresSponsor.logo_url} alt={scoresSponsor.business_name} className="w-8 h-8 object-contain rounded flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }} />}<div className="flex-1 min-w-0"><p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.1em' }}>SCORES PRESENTED BY</p><p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{scoresSponsor.business_name}</p>{scoresSponsor.tagline && <p className="text-xs text-slate-400 truncate">{scoresSponsor.tagline}</p>}</div><span className="text-xs font-bold text-blue-400 flex-shrink-0" style={{ fontFamily: 'var(--font-display)' }}>Visit →</span></a>}
      </div>
      <ScoresClient games={games || []} crossCountryMeets={crossCountryMeets} sports={sports || []} selectedDate={selectedDate} today={today} datesWithGames={datesWithGames} />
    </PublicLayout>
  )
}
