// src/app/(public)/standings/page.tsx
import { createPublicClient as createClient } from '@/lib/supabase/public'
import { unstable_noStore as noStore } from 'next/cache'
import { Metadata } from 'next'
import Link from 'next/link'
import { calculateStandings } from '@/lib/standings'
import { calculateCrossCountryStandings } from '@/lib/cross-country'
import { GameWithTeams } from '@/types'
import { Trophy } from 'lucide-react'
import PublicLayout from '@/components/layout/PublicLayout'
import StandingsToggle from '@/components/StandingsToggle'

export const metadata: Metadata = {
  title: 'Standings | Section X Scoreboard',
  description: 'Section X high school sports standings with league record, overall record, and Bradley-Terry Model rankings.',
}

export const dynamic = 'force-dynamic'

interface Props { searchParams: { sport?: string; season?: string } }

const DIVISION_ORDER = ['East', 'Central', 'West', 'North', 'South']

const SEASON_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Spring: { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', border: 'rgba(34,197,94,0.25)' },
  Fall: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  Winter: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
}

function normalizeJoinedRecord<T = any>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function sportLabel(sport: any) {
  const name = String(sport?.sport_name || '').trim()
  const gender = String(sport?.gender || '').trim()
  if ((gender === 'Boys' || gender === 'Girls') && !name.toLowerCase().startsWith(gender.toLowerCase() + ' ')) {
    return `${gender} ${name}`
  }
  return name
}

export default async function StandingsPage({ searchParams }: Props) {
  noStore()
  const supabase = createClient()

  const { data: allSeasons } = await supabase
    .from('seasons')
    .select('id, name, is_active, season_type, year')
    .order('year', { ascending: false })

  const activeSeason = (allSeasons || []).find((s: any) => s.is_active)
  const selectedSeasonId = searchParams.season || activeSeason?.id
  const selectedSeason = (allSeasons || []).find((s: any) => s.id === selectedSeasonId) || activeSeason

  const { data: seasonTeamRows } = selectedSeasonId
    ? await supabase
        .from('team_seasons')
        .select(`
          team_id,
          division,
          class,
          btm_override,
          active_for_season,
          team:teams(
            id,
            team_name,
            slug,
            sport_id,
            level,
            active,
            school:schools(
              id,
              school_name,
              slug,
              primary_color,
              is_section_x
            )
          )
        `)
        .eq('season_id', selectedSeasonId)
        .neq('active_for_season', false)
    : { data: [] }

  const activeTeamSeasons = (seasonTeamRows || []).filter((record: any) => {
    const team = normalizeJoinedRecord<any>(record.team)
    if (!team) return false
    if (team.active === false) return false
    if (team.level && team.level.toLowerCase().trim() !== 'varsity') return false
    return true
  })

  const activeSportIds = new Set(
    activeTeamSeasons
      .map((record: any) => normalizeJoinedRecord<any>(record.team)?.sport_id)
      .filter(Boolean)
  )

  const { data: allSports } = await supabase
    .from('sports')
    .select('id, sport_name, slug, gender')
    .order('sport_name')

  const uniqueSports = (allSports || [])
    .filter((sport: any) => {
      if (activeSportIds.has(sport.id)) return true
      if (selectedSeason?.season_type === 'Fall' && ['boys-cross-country','girls-cross-country'].includes(sport.slug)) return true
      return false
    })
    .sort((a: any, b: any) => sportLabel(a).localeCompare(sportLabel(b)))

  const preferredDefault = uniqueSports.find((s:any)=>s.slug==='boys-soccer') || uniqueSports.find((s:any)=>s.slug==='girls-soccer') || uniqueSports[0]
  const selectedSlug = searchParams.sport || preferredDefault?.slug
  const selectedSport =
    (allSports || []).find((s: any) => s.slug === selectedSlug) ||
    uniqueSports[0]

  let standings: any[] = []

  if (selectedSport && selectedSeasonId) {
    let sportTeamSeasons = activeTeamSeasons.filter((record: any) => {
      const team = normalizeJoinedRecord<any>(record.team)
      return team?.sport_id === selectedSport.id
    })

    // Official Section X Volleyball divisions for the 2026 season.
    // Keep this as the source of truth for volleyball standings even if
    // team_seasons division data is missing or was imported incorrectly.
    if (selectedSport.slug === 'volleyball') {
      const volleyballDivisions: Record<string, 'East' | 'West'> = {
        'Brushton-Moira': 'East',
        'Chateaugay': 'East',
        'Malone': 'East',
        'Massena': 'East',
        'Salmon River': 'East',
        'Tupper Lake': 'East',
        'Canton': 'West',
        'Clifton-Fine': 'West',
        'Gouverneur': 'West',
        'Madrid-Waddington': 'West',
        'Ogdensburg Free Academy': 'West',
        'Potsdam': 'West',
      }

      sportTeamSeasons = sportTeamSeasons.map((record: any) => {
        const team = normalizeJoinedRecord<any>(record.team)
        const school = normalizeJoinedRecord<any>(team?.school)
        const officialDivision = volleyballDivisions[String(school?.school_name || '').trim()]
        return officialDivision ? { ...record, division: officialDivision } : record
      })
    }

    if (selectedSport.slug === 'boys-cross-country' || selectedSport.slug === 'girls-cross-country') {
      const [{ data: xcMeets }, { data: xcResults }, { data: xcTeams }, { data: xcDuals }] = await Promise.all([
        supabase.from('cross_country_meets').select('id,status,meet_type,season_id').eq('season_id', selectedSeasonId),
        supabase.from('cross_country_team_results').select('meet_id,sport_id,team_id,team_score').eq('sport_id', selectedSport.id),
        supabase.from('teams').select(`id,team_name,slug,sport_id,level,active,school:schools(id,school_name,slug,is_section_x)`).eq('sport_id', selectedSport.id).eq('active', true),
        supabase.from('cross_country_dual_results').select('meet_id,sport_id,team_a_id,team_b_id,outcome_a').eq('sport_id',selectedSport.id),
      ])
      const xcTeamSeasonShape = (xcTeams || [])
        .filter((team:any) => !team.level || team.level.toLowerCase().trim() === 'varsity')
        .map((team:any) => ({ team }))
      standings = calculateCrossCountryStandings(xcMeets || [], xcResults || [], xcTeamSeasonShape, selectedSport.id, xcDuals || [])
    } else {
      const { data: gamesData } = await supabase
        .from('games')
        .select(`*, sport:sports(sport_name, gender), home_team:teams!games_home_team_id_fkey(*, school:schools(*)), away_team:teams!games_away_team_id_fkey(*, school:schools(*))`)
        .eq('sport_id', selectedSport.id)
        .eq('season_id', selectedSeasonId)
        .eq('status', 'Final')

      standings = calculateStandings(
        (gamesData as GameWithTeams[]) || [],
        sportTeamSeasons,
        selectedSport.sport_name
      )
    }
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
    const classes = [...new Set(standings.map(r => r.class || ''))]
      .filter(Boolean)
      .sort((a, b) => CLASS_ORDER_SORT.indexOf(a) - CLASS_ORDER_SORT.indexOf(b))

    for (const cls of classes) {
      const rows = standings
        .filter(r => r.class === cls)
        .sort((a, b) => {
          const ranked = b.btm - a.btm || b.wins - a.wins || a.losses - b.losses
          if (ranked !== 0) return ranked
          return (a.school_name || a.team_name).localeCompare(b.school_name || b.team_name)
        })

      if (rows.length > 0) classGroups.push({ label: `Class ${cls}`, rows })
    }

    const noClassRows = standings.filter(r => !r.class)
    if (noClassRows.length > 0) classGroups.push({ label: 'Unclassified', rows: noClassRows })
  } else {
    classGroups.push({ label: '', rows: standings })
  }

  const icons: Record<string, string> = {
    Baseball: '⚾', Softball: '🥎',
    'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
    Football: '🏈',
    'Boys Basketball': '🏀', 'Girls Basketball': '🏀',
    'Boys Hockey': '🏒', 'Girls Hockey': '🏒',
    'Boys Soccer': '⚽', 'Girls Soccer': '⚽',
    Volleyball: '🏐', 'Boys Golf': '⛳',
    'Boys Wrestling': '🤼', 'Girls Wrestling': '🤼',
    'Boys Track': '🏃', 'Girls Track': '🏃',
    Swimming: '🏊', 'Girls Swimming': '🏊',
    'Boys Cross Country': '🏃', 'Girls Cross Country': '🏃',
  }

  const isPreseason = standings.length > 0 && standings.every(
    row => row.wins === 0 && row.losses === 0 && row.ties === 0
  )

  const isCrossCountry = selectedSport?.slug === 'boys-cross-country' || selectedSport?.slug === 'girls-cross-country'

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Trophy size={28} className="text-yellow-400 flex-shrink-0" />
          <div>
            <h1 className="text-3xl font-bold font-display text-white">Standings</h1>
            {selectedSeason && (
              <p className="text-slate-400 text-sm mt-0.5">
                {selectedSeason.name} · BTM = Bradley-Terry Model
              </p>
            )}
          </div>
        </div>

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
                <a
                  key={s.id}
                  href={s.is_active ? '/standings' : `/standings?season=${s.id}`}
                  className="text-xs font-black px-3 py-1 rounded-full transition-all"
                  style={{
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '0.06em',
                    background: isSelected ? c.bg : 'rgba(255,255,255,0.04)',
                    color: isSelected ? c.text : '#4a5f7a',
                    border: `1px solid ${isSelected ? c.border : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  {s.name}{s.is_active ? ' ✓' : ''}
                </a>
              )
            })}
          </div>
        )}

        {uniqueSports.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {uniqueSports.map((s: any) => {
              const fullName = sportLabel(s)
              const icon = icons[fullName] || icons[s.sport_name] || '🏆'
              const seasonParam = searchParams.season ? `&season=${searchParams.season}` : ''

              return (
                <Link
                  key={s.slug}
                  href={`/standings?sport=${s.slug}${seasonParam}`}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    s.slug === selectedSlug
                      ? 'bg-ice text-navy'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {icon} {fullName}
                </Link>
              )
            })}
          </div>
        )}

        {standings.length === 0 ? (
          <div className="card p-10 text-center text-slate-400">
            <p className="text-3xl mb-3">🏆</p>
            <p className="font-medium text-lg">
              No active teams found{selectedSport ? ` for ${sportLabel(selectedSport)}` : ''}.
            </p>
            <p className="text-sm mt-1">
              Teams will appear here once they are activated for this season.
            </p>
          </div>
        ) : isCrossCountry ? (
          <>
            <div className="mb-4 rounded-xl px-4 py-3 border border-lime-500/20 bg-lime-500/5">
              <p className="text-sm font-bold text-lime-300">{sportLabel(selectedSport)} league standings</p>
              <p className="text-xs text-slate-400 mt-0.5">
                League meets only. Lower team score wins each head-to-head matchup. Invitational results do not affect W-L.
              </p>
            </div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-white/10 bg-white/[0.02]">
                      <th className="text-left px-4 py-3 font-medium w-8"></th>
                      <th className="text-left px-2 py-3 font-medium">Team</th>
                      <th className="text-center px-3 py-3 font-medium">W</th>
                      <th className="text-center px-3 py-3 font-medium">L</th>
                      <th className="text-center px-3 py-3 font-medium">T</th>
                      <th className="text-center px-3 py-3 font-medium">PCT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row: any, i: number) => (
                      <tr key={row.team_id} className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 text-slate-500 text-xs font-mono">{i + 1}</td>
                        <td className="px-2 py-3">
                          <Link href={`/teams/${row.team_slug || row.slug}`} className="text-white font-medium hover:text-blue-400 transition-colors text-sm">
                            {row.school_name}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-slate-300">{row.wins}</td>
                        <td className="px-3 py-3 text-center font-mono text-slate-300">{row.losses}</td>
                        <td className="px-3 py-3 text-center font-mono text-slate-400">{row.ties || 0}</td>
                        <td className="px-3 py-3 text-center font-mono font-bold text-white">{row.win_pct.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            {isPreseason && (
              <div className="mb-4 rounded-xl px-4 py-3 border border-blue-500/20 bg-blue-500/5">
                <p className="text-sm font-bold text-blue-300">Preseason standings</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Every team starts 0-0. Standings update automatically as final scores are reported.
                </p>
              </div>
            )}

            <StandingsToggle
              divisionGroups={divisionGroups}
              classGroups={classGroups}
              hasDivision={hasDivision}
              hasClass={hasClass}
            />
          </>
        )}

        {standings.length > 0 && (
          <p className="text-xs text-slate-500 mt-4">
            {selectedSport?.slug === 'boys-cross-country' || selectedSport?.slug === 'girls-cross-country'
              ? 'Cross country league standings use head-to-head results within Section X league meets. Lower team score wins. Invitational results do not affect league W-L.'
              : selectedSport?.sport_name === 'Boys Golf' || selectedSport?.sport_name === 'Girls Golf'
                ? 'Golf standings: lower scores are better.'
                : 'BTM (Bradley-Terry Model) uses in-section wins, losses and ties plus opponent strength. Margin of victory and home/away location are not weighted. The displayed value is the model’s average predicted win probability against teams in the school’s playoff class. Higher is better.'
            }
          </p>
        )}
      </div>
    </PublicLayout>
  )
}
