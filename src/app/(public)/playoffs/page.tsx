import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import BracketView from './BracketView'

export const metadata: Metadata = {
  title: 'Playoffs | Section X Scoreboard',
  description: 'Section X playoff brackets for baseball and softball.',
}
export const dynamic = 'force-dynamic'

export default async function PlayoffsPage() {
  const supabase = createClient()

  const { data: tournaments } = await supabase
    .from('playoff_tournaments')
    .select(`*, sport:sports(sport_name, gender), season:seasons(name)`)
    .order('class')

  const { data: allGames } = await supabase
    .from('playoff_games')
    .select('*')
    .order('round').order('position')

  const sportGroups = (tournaments || []).reduce((acc: any, t: any) => {
    const key = `${t.sport?.gender} ${t.sport?.sport_name}`
    if (!acc[key]) acc[key] = []
    acc[key].push({
      ...t,
      games: (allGames || []).filter(g => g.tournament_id === t.id)
    })
    return acc
  }, {})

  const SPORT_ICONS: Record<string, string> = {
    'Girls Softball': '🥎', 'Boys Baseball': '⚾',
    'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
  }

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">🏆</span>
          <div>
            <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              Section X Playoffs
            </h1>
            <p className="text-slate-400 text-sm">Single elimination · Seeded by BTM ranking</p>
          </div>
        </div>

        {Object.keys(sportGroups).length === 0 && (
          <div className="rounded-2xl p-16 text-center border border-white/6" style={{ background: 'rgba(8,12,20,0.7)' }}>
            <p className="text-5xl mb-4">🏆</p>
            <p className="text-white font-black text-xl" style={{ fontFamily: 'var(--font-display)' }}>Brackets Coming Soon</p>
            <p className="text-slate-500 text-sm mt-2">Playoff brackets will appear here once seedings are set.</p>
          </div>
        )}

        {Object.entries(sportGroups).map(([sport, tournaments]: any) => (
          <div key={sport} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">{SPORT_ICONS[sport] || '🏆'}</span>
              <h2 className="text-2xl font-black text-white uppercase tracking-widest"
                style={{ fontFamily: 'var(--font-display)' }}>{sport}</h2>
              <div className="flex-1 h-px bg-white/8 ml-2" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {tournaments.sort((a: any, b: any) => a.class.localeCompare(b.class)).map((t: any) => (
                <BracketView key={t.id} tournament={t} games={t.games} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </PublicLayout>
  )
}
