// src/app/(public)/standings/page.tsx
import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Link from 'next/link'
import { calculateStandings } from '@/lib/standings'
import { GameWithTeams } from '@/types'
import { Trophy } from 'lucide-react'
import PublicLayout from '@/components/layout/PublicLayout'
import StandingsToggle from '@/components/StandingsToggle'

export const metadata: Metadata = {
  title: 'Standings | Section X Scoreboard',
  description: 'Section X high school sports standings with league record, overall record, and BTM rankings.',
}
export const dynamic = 'force-dynamic'

interface Props { searchParams: { sport?: string; season?: string } }

const DIVISION_ORDER = ['East', 'Central', 'West', 'North', 'South']

const SEASON_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Spring: { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', border: 'rgba(34,197,94,0.25)' },
  Fall:   { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  Winter: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
}

export default async function StandingsPage({ searchParams }: Props) {
  const supabase = createClient()

  // Fetch all seasons for the switcher
  const { data: allSeasons } = await supabase
    .from('seasons')
    .select('id, name, is_active, season_type, year')
    .order('year', { ascending: false })

  const activeSeason = (allSeasons || []).find((s: any) => s.is_active)

  // Use season from URL param, fall back to active season
  const selectedSeasonId = searchParams.season || activeSeason?.id
  const selectedSeason = (allSeasons || []).find((s: any) => s.id === selectedSeasonId) || activeSeason

  // Sports that have final games in the selected season
  const { data: gamesForSports } = selectedSeasonId ? await supabase
    .from('games')
    .select('sport_id, sport:sports(id, sport_name, slug, gender)')
    .eq('season_id', selectedSeasonId)
    .eq('status', 'Final') : { data: [] }

  const uniqueSports: any[] = Object.values(
    ((gamesForSports || []) as any[]).reduce((acc: any, g: any) => {
      if (g.sport) acc[g.sport_id] = g.sport
      return acc
    }, {})
  )
  uniqueSports.sort((a, b) => a.sport_name.localeCompare(b.sport_name))

  const selectedSlug = searchParams.sport || uniqueSports[0]?.slug
  const selectedSport = uniqueSports.find((s: any) => s.slug === selectedSlug) || uniqueSports[0]

  let standings: any[] = []

  if (selectedSport && selectedSeasonId) {
    const [{ data: gamesData }, { data: tsData }] = await Promise.all([
      supabase
        .from('games')
        .select(`*, sport:sports(sport_name, gender), home_team:teams!games_home_team_id_fkey(*, school:schools(*)), away_team:teams!games_away_team_id_fkey(*, school:schools(*))`)
        .eq('sport_id', selectedSport.id)
        .eq('season_id', selectedSeasonId)
        .eq('status', 'Final'),
      supabase.from('team_seasons').select('team_id, division, class, btm_override').eq('season_id', selectedSeasonId),
    ])
    standings = calculateStandings((gamesData as GameWithTeams[]) || [], tsData || [], selectedSport?.sport_name)
  }

  interface Group { label: string; subLabel?: string; rows: any[] }
  const divisionGroups: Group[] = []
  const classGroups: Group[] = []

  const hasDivision = standings.some(r => r.division)
  const hasClass = standings.some(r => r.class)

  if (hasDivision) {
    const divs = [...new Set(standings.map(r => r.division || ''))].filter(Boolean)
    const sortedDivs = [
      ...DIVISION_ORDER.filter(d => divs.includes(d)),
      ...divs.filter(d => !DIVISION_ORDER.includes(d)),
    ]
    for (const div of sortedDivs) {
      const rows = standings.filter(r => r.division === div)
      if (rows.length > 0) divisionGroups.push({ label: `${div} Division`, rows })
    }
    const noDivRows = standings.filter(r => !r.division)
    if (noDivRows.length > 0) divisionGroups.push({ label: 'Non-League', rows: noDivRows })
  } else {
    divisionGroups.push({ label: '', rows: standings })
  }

  const CLASS_ORDER_SORT = ['A', 'B', 'C', 'D']
  if (hasClass) {
    const classes = [...new Set(standings.map(r => r.class || ''))].filter(Boolean)
      .sort((a, b) => CLASS_ORDER_SORT.indexOf(a) - CLASS_ORDER_SORT.indexOf(b))
    for (const cls of classes) {
      const rows = standings.filter(r => r.class === cls).sort((a, b) => b.btm - a.btm)
      if (rows.length > 0) classGroups.push({ label: `Class ${cls}`, rows })
    }
    const noClassRows = standings.filter(r => !r.class)
    if (noClassRows.length > 0) classGroups.push({ label: 'Unclassified', rows: noClassRows })
  } else {
    classGroups.push({ label: '', rows: standings })
  }

  const icons: Record<string, string> = {
    'Baseball': '⚾', 'Softball': '🥎',
    'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
    'Football': '🏈',
    'Boys Basketball': '🏀', 'Girls Basketball': '🏀',
    'Boys Hockey': '🏒', 'Girls Hockey': '🏒',
    'Boys Soccer': '⚽', 'Girls Soccer': '⚽',
    'Volleyball': '🏐', 'Boys Golf': '⛳',
    'Boys Wrestling': '🤼', 'Girls Wrestling': '🤼',
    'Boys Track': '🏃', 'Girls Track': '🏃',
    'Swimming': '🏊', 'Girls Swimming': '🏊',
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Trophy size={28} className="text-yellow-400 flex-shrink-0" />
          <div>
            <h1 className="text-3xl font-bold font-display text-white">Standings</h1>
            {selectedSeason && (
              <p className="text-slate-400 text-sm mt-0.5">
                {selectedSeason.name} · BTM = Binomial Tournament Method
              </p>
            )}
          </div>
        </div>

        {/* Season Switcher */}
        {(allSeasons || []).length > 1 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <span className="text-xs text-slate-500 flex-shrink-0"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
              SEASON:
            </span>
            {(allSeasons || []).map((s: any) => {
              const isSelected = s.id === selectedSeasonId
              const c = SEASON_COLORS[s.season_type || 'Spring'] || SEASON_COLORS.Spring
              return (
                <a key={s.id}
                  href={s.is_active ? '/standings' : `/standings?season=${s.id}`}
                  className="text-xs font-black px-3 py-1 rounded-full transition-all"
                  style={{
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '0.06em',
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

        {/* Sport tabs */}
        {uniqueSports.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {uniqueSports.map((s: any) => {
              const fullName = (s.gender === 'Boys' || s.gender === 'Girls') ? `${s.gender} ${s.sport_name}` : s.sport_name
              const icon = icons[fullName] || icons[s.sport_name] || '🏆'
              const seasonParam = searchParams.season ? `&season=${searchParams.season}` : ''
              return (
                <Link key={s.slug}
                  href={`/standings?sport=${s.slug}${seasonParam}`}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    s.slug === selectedSlug ? 'bg-ice text-navy' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}>
                  {icon} {s.sport_name}
                </Link>
              )
            })}
          </div>
        )}

        {/* No data */}
        {standings.length === 0 ? (
          <div className="card p-10 text-center text-slate-400">
            <p className="text-3xl mb-3">🏆</p>
            <p className="font-medium text-lg">No standings yet{selectedSport ? ` for ${selectedSport.sport_name}` : ''}.</p>
            <p className="text-sm mt-1">Standings calculate automatically from final scores.</p>
          </div>
        ) : (
          <StandingsToggle
            divisionGroups={divisionGroups}
            classGroups={classGroups}
            hasDivision={hasDivision}
            hasClass={hasClass}
          />
        )}

        {standings.length > 0 && (
          <p className="text-xs text-slate-500 mt-4">
            {selectedSport?.sport_name === 'Boys Golf' || selectedSport?.sport_name === 'Girls Golf'
              ? 'Golf standings: lower scores are better.'
              : 'BTM (Binomial Tournament Method): (W + 0.5) / (W + L + 1) — the official Section X playoff seeding formula. Higher is better.'
            }
          </p>
        )}
      </div>
    </PublicLayout>
  )
}
