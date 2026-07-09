// src/app/(public)/playoffs/page.tsx
import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'

export const metadata: Metadata = {
  title: 'Section X Playoffs 2026 | Brackets & Results',
  description: 'Section X high school sports playoff brackets for baseball, softball, lacrosse and more. Northern New York.',
}
export const dynamic = 'force-dynamic'

const ICONS: Record<string, string> = {
  'Girls Softball': '🥎', 'Boys Baseball': '⚾',
  'Boys Lacrosse': '🥍', 'Girls Lacrosse': '🥍',
  'Boys Basketball': '🏀', 'Girls Basketball': '🏀',
  'Boys Hockey': '🏒', 'Girls Hockey': '🏒',
  'Football': '🏈', 'Boys Soccer': '⚽', 'Girls Soccer': '⚽',
  'Volleyball': '🏐',
}

function cleanName(name: string): string {
  return name
    .replace('Boys Boys ', 'Boys ')
    .replace('Girls Girls ', 'Girls ')
    .replace('Boys Baseball', 'Boys Baseball')
    .replace('Girls Softball', 'Girls Softball')
}

function getSportDisplayName(sportName: string, gender: string): string {
  if (!sportName || !gender) return sportName || ''
  // Prevent doubling
  if (sportName.startsWith(gender + ' ')) return sportName
  if (gender === 'Boys' && sportName === 'Baseball') return 'Boys Baseball'
  if (gender === 'Girls' && sportName === 'Softball') return 'Girls Softball'
  if (gender === 'Boys' && sportName === 'Lacrosse') return 'Boys Lacrosse'
  if (gender === 'Girls' && sportName === 'Lacrosse') return 'Girls Lacrosse'
  return `${gender} ${sportName}`
}

export default async function PlayoffsPage() {
  const supabase = createClient()

  const { data: tournaments } = await supabase
    .from('playoff_tournaments')
    .select('*, sport:sports(sport_name, gender), season:seasons(name)')
    .order('class')

  const { data: games } = await supabase
    .from('playoff_games').select('tournament_id, status')

  // Fetch playoff bracket sponsor
  const { data: playoffSponsor } = await supabase
    .from('sponsors')
    .select('*')
    .eq('placement_type', 'playoff')
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  const bySport: Record<string, any[]> = {}
  for (const t of (tournaments || [])) {
    const key = getSportDisplayName(t.sport?.sport_name || '', t.sport?.gender || '')
    if (!bySport[key]) bySport[key] = []
    const tGames = (games || []).filter(g => g.tournament_id === t.id)
    const finals = tGames.filter(g => g.status === 'final').length
    // Clean the tournament name too
    bySport[key].push({ ...t, name: cleanName(t.name || ''), gameCount: tGames.length, finalCount: finals })
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🏆</span>
          <div>
            <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>Section X Playoffs</h1>
            <p className="text-slate-400 text-sm">Single elimination · Seeded by BTM</p>
          </div>
        </div>

        {/* Playoff Sponsor Banner */}
        {playoffSponsor && (
          <a href={(playoffSponsor as any).website_url || '#'} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5 transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.1), rgba(8,12,20,0.8))', border: '1px solid rgba(234,179,8,0.2)' }}>
            {(playoffSponsor as any).logo_url && (
              <img src={(playoffSponsor as any).logo_url} alt={(playoffSponsor as any).business_name}
                className="w-8 h-8 object-contain rounded flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-yellow-600" style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.1em' }}>PLAYOFFS PRESENTED BY</p>
              <p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{(playoffSponsor as any).business_name}</p>
              {(playoffSponsor as any).tagline && <p className="text-xs text-slate-400 truncate">{(playoffSponsor as any).tagline}</p>}
            </div>
            <span className="text-xs font-bold text-yellow-400 flex-shrink-0" style={{ fontFamily: 'var(--font-display)' }}>Visit →</span>
          </a>
        )}

        {Object.keys(bySport).length === 0 && (
          <div className="rounded-2xl p-16 text-center border border-white/6" style={{ background: 'rgba(8,12,20,0.7)' }}>
            <p className="text-5xl mb-4">🏆</p>
            <p className="text-white font-black text-xl" style={{ fontFamily: 'var(--font-display)' }}>Brackets Coming Soon</p>
            <p className="text-slate-500 text-sm mt-2">Playoff brackets will appear once seedings are announced.</p>
          </div>
        )}

        {Object.entries(bySport).map(([sport, ts]) => (
          <div key={sport} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{ICONS[sport] || '🏆'}</span>
              <h2 className="text-xl font-black text-white uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>{sport}</h2>
              <div className="flex-1 h-px bg-white/8 ml-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {ts.sort((a, b) => a.class.localeCompare(b.class)).map(t => (
                <Link key={t.id} href={`/playoffs/${t.id}`}
                  className="rounded-xl p-4 border transition-all hover:-translate-y-0.5 hover:shadow-xl group"
                  style={{
                    background: 'rgba(8,12,20,0.8)',
                    border: t.status === 'active' ? '1px solid rgba(239,68,68,0.3)'
                      : t.status === 'complete' ? '1px solid rgba(34,197,94,0.2)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-black text-blue-400 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>Class {t.class}</span>
                    <span className="text-xs font-black px-1.5 py-0.5 rounded uppercase"
                      style={{
                        fontFamily: 'var(--font-display)',
                        background: t.status === 'complete' ? 'rgba(34,197,94,0.15)' : t.status === 'active' ? 'rgba(239,68,68,0.12)' : 'rgba(37,99,235,0.1)',
                        color: t.status === 'complete' ? '#4ade80' : t.status === 'active' ? '#f87171' : '#60a5fa',
                      }}>{t.status}</span>
                  </div>
                  <p className="text-white font-bold text-sm mb-2 group-hover:text-blue-300 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>{t.name}</p>
                  <p className="text-xs text-slate-600">{t.finalCount} of {t.gameCount} games complete</p>
                  <p className="text-xs font-bold text-blue-400 mt-2 group-hover:text-blue-300" style={{ fontFamily: 'var(--font-display)' }}>View Bracket →</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PublicLayout>
  )
}
