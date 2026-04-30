import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Link from 'next/link'
import { calculateStandings } from '@/lib/standings'
import { GameWithTeams } from '@/types'
import { Trophy } from 'lucide-react'
import PublicLayout from '@/components/layout/PublicLayout'

export const metadata: Metadata = {
  title: 'Standings | Section X Scoreboard',
  description: 'Section X high school sports standings with league record, overall record, and BTM rankings.',
}
export const dynamic = 'force-dynamic'

interface Props { searchParams: { sport?: string } }

const DIVISION_ORDER = ['East', 'Central', 'West', 'North', 'South']

export default async function StandingsPage({ searchParams }: Props) {
  const supabase = createClient()

  const { data: activeSeason } = await supabase.from('seasons').select('*').eq('is_active', true).single()
  const seasonId = activeSeason?.id

  // Sports that have final games this season
  const { data: gamesForSports } = seasonId ? await supabase
    .from('games')
    .select('sport_id, sport:sports(id, sport_name, slug, gender)')
    .eq('season_id', seasonId)
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

  if (selectedSport && seasonId) {
    const [{ data: gamesData }, { data: tsData }] = await Promise.all([
      supabase
        .from('games')
        .select(`*, sport:sports(sport_name, gender), home_team:teams!games_home_team_id_fkey(*, school:schools(*)), away_team:teams!games_away_team_id_fkey(*, school:schools(*))`)
        .eq('sport_id', selectedSport.id)
        .eq('season_id', seasonId)
        .eq('status', 'Final'),
      supabase.from('team_seasons').select('team_id, division, class').eq('season_id', seasonId),
    ])
    standings = calculateStandings((gamesData as GameWithTeams[]) || [], tsData || [])
  }

  // Group by DIVISION only (class is for playoffs, not regular season standings)
  interface Group { label: string; subLabel?: string; rows: any[] }
  const groups: Group[] = []

  const hasDivision = standings.some(r => r.division)

  if (hasDivision) {
    const divs = [...new Set(standings.map(r => r.division || ''))].filter(Boolean)
    const sortedDivs = [
      ...DIVISION_ORDER.filter(d => divs.includes(d)),
      ...divs.filter(d => !DIVISION_ORDER.includes(d)),
    ]
    for (const div of sortedDivs) {
      const rows = standings.filter(r => r.division === div)
      if (rows.length > 0) groups.push({ label: `${div} Division`, rows })
    }
    // Teams with no division assigned
    const noDivRows = standings.filter(r => !r.division)
    if (noDivRows.length > 0) groups.push({ label: 'Non-League', rows: noDivRows })
  } else {
    groups.push({ label: '', rows: standings })
  }

  const StandingsTable = ({ group }: { group: Group }) => (
    <div className="card overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div>
          {group.label && <h3 className="text-white font-bold font-display uppercase tracking-wide">{group.label}</h3>}
          {group.subLabel && <p className="text-slate-400 text-xs mt-0.5">{group.subLabel}</p>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-white/10 bg-white/[0.02]">
              <th className="text-left px-4 py-3 font-medium w-8"></th>
              <th className="text-left px-2 py-3 font-medium">Team</th>
              <th className="text-center px-3 py-3 font-medium whitespace-nowrap">League<br/>Record</th>
              <th className="text-center px-3 py-3 font-medium whitespace-nowrap">Overall<br/>Record</th>
              <th className="text-center px-3 py-3 font-medium whitespace-nowrap">BTM<br/>Ranking</th>
              <th className="text-center px-3 py-3 font-medium hidden md:table-cell">PF</th>
              <th className="text-center px-3 py-3 font-medium hidden md:table-cell">PA</th>
              <th className="text-center px-3 py-3 font-medium hidden md:table-cell">DIFF</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, i) => {
              const diff = row.points_for - row.points_against
              const leagueRecord = `${row.league_wins}-${row.league_losses}${row.league_ties > 0 ? `-${row.league_ties}` : ''}`
              const overallRecord = `${row.wins}-${row.losses}${row.ties > 0 ? `-${row.ties}` : ''}`
              return (
                <tr key={row.team_id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i === 0 ? 'bg-yellow-500/5' : ''}`}>
                  <td className="px-4 py-3 text-slate-500 text-xs">{i + 1}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: row.primary_color || '#334155' }} />
                      <Link href={`/teams/${row.slug || row.team_slug}`} className="text-white hover:text-ice transition-colors font-medium truncate">
                        {row.school_name || row.team_name}
                      </Link>
                    </div>
                  </td>
                  <td className="text-center px-3 py-3 font-mono text-slate-200">{leagueRecord}</td>
                  <td className="text-center px-3 py-3 font-mono text-slate-300">{overallRecord}</td>
                  <td className="text-center px-3 py-3 font-mono font-bold text-ice">{row.btm.toFixed(3)}</td>
                  <td className="text-center px-3 py-3 text-slate-400 font-mono hidden md:table-cell">{row.points_for}</td>
                  <td className="text-center px-3 py-3 text-slate-400 font-mono hidden md:table-cell">{row.points_against}</td>
                  <td className={`text-center px-3 py-3 font-mono font-bold hidden md:table-cell ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Trophy size={28} className="text-yellow-400 flex-shrink-0" />
          <div>
            <h1 className="text-3xl font-bold font-display text-white">Standings</h1>
            {activeSeason && <p className="text-slate-400 text-sm mt-0.5">{activeSeason.name} · BTM = Binomial Tournament Method</p>}
          </div>
        </div>

        {/* Sport tabs */}
        {uniqueSports.length > 0 && (
          <div className="flex flex-wrap gap-2 my-5">
            {uniqueSports.map((s: any) => (
              <Link
                key={s.slug}
                href={`/standings?sport=${s.slug}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  s.slug === selectedSlug ? 'bg-ice text-navy' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
  {(() => {
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
                  'Cross Country': '🏃',
                }
                const fullName = (s.gender === 'Boys' || s.gender === 'Girls') ? s.gender + ' ' + s.sport_name : s.sport_name
                const icon = icons[fullName] || icons[s.sport_name] || '🏆'
                return icon + ' ' + s.sport_name
              })()}
              </Link>
            ))}
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
          groups.map((group, i) => <StandingsTable key={i} group={group} />)
        )}

        {/* Explainer */}
        {standings.length > 0 && (
          <p className="text-xs text-slate-500 mt-4">
            {selectedSport?.sport_name === 'Boys Golf' || selectedSport?.sport_name === 'Girls Golf'
              ? 'Golf standings: lower scores are better. Points = match play points vs opponents.'
              : 'BTM (Binomial Tournament Method): (W + 0.5) / (W + L + 1) — the official Section X playoff seeding formula. Higher is better.'
            }
          </p>
        )}
      </div>
    </PublicLayout>
  )
}
