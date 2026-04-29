// src/app/(public)/schools/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'
import ScoreCard from '@/components/scores/ScoreCard'
import { format, parseISO } from 'date-fns'

export const revalidate = 300

interface PageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createClient()
  const { data: school } = await supabase.from('schools').select('*').eq('slug', params.slug).single()
  if (!school) return { title: 'School Not Found' }
  return {
    title: `${school.school_name} | ${school.mascot}`,
    description: `${school.school_name} sports scores, schedules, and standings. ${school.mascot} of ${school.city}, ${school.county} County.`,
  }
}

export default async function SchoolPage({ params }: PageProps) {
  const supabase = createClient()

  const { data: school, error } = await supabase
    .from('schools')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!school || error) notFound()

  // Teams
  const { data: teams } = await supabase
    .from('teams')
    .select('*, sport:sports(*)')
    .eq('school_id', school.id)
    .eq('active', true)
    .order('team_name')

  // Recent games
  const teamIds = (teams || []).map(t => t.id)
  const { data: recentGames } = teamIds.length > 0
    ? await supabase
        .from('games')
        .select(`
          *,
          sport:sports(*),
          home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
          away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
          external_home:external_opponents!games_external_home_opponent_id_fkey(*),
          external_away:external_opponents!games_external_away_opponent_id_fkey(*)
        `)
        .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
        .eq('status', 'Final')
        .order('game_date', { ascending: false })
        .limit(10)
    : { data: [] }

  // Photos
  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('school_id', school.id)
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(6)

  // Sponsor
  const { data: sponsor } = await supabase
    .from('sponsors')
    .select('*')
    .eq('placement', 'school_page')
    .eq('active', true)
    .single()

  const sportsBySeason: Record<string, typeof teams> = {}
  for (const team of teams || []) {
    const s = team.sport?.season_type || 'Other'
    if (!sportsBySeason[s]) sportsBySeason[s] = []
    sportsBySeason[s]!.push(team)
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div
          className="rounded-xl p-6 mb-6"
          style={{
            background: `linear-gradient(135deg, ${school.primary_color || '#1e2d47'} 0%, ${school.secondary_color || '#243560'} 100%)`,
          }}
        >
          <nav className="text-xs mb-3 opacity-70">
            <Link href="/schools" className="hover:opacity-100">Schools</Link>
            <span className="mx-2">/</span>
            <span>{school.school_name}</span>
          </nav>
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                {school.school_name}
              </h1>
              <p className="text-white/80 mt-1">{school.mascot} · {school.city}, {school.county} County</p>
            </div>
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center font-bold text-2xl text-white opacity-80"
              style={{ background: 'rgba(0,0,0,0.3)', fontFamily: 'var(--font-display)' }}
            >
              {school.alias || school.school_name.slice(0, 2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            {/* Recent results */}
            {(recentGames || []).length > 0 && (
              <section>
                <h2 className="section-title text-lg mb-3">Recent Results</h2>
                <div className="space-y-2">
                  {(recentGames || []).slice(0, 6).map(game => (
                    <ScoreCard key={game.id} game={game as any} compact />
                  ))}
                </div>
              </section>
            )}

            {/* Photos */}
            {photos && photos.length > 0 && (
              <section>
                <h2 className="section-title text-lg mb-3">Photos</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {photos.map(p => (
                    <div key={p.id} className="card overflow-hidden">
                      <img src={p.photo_url} alt={p.caption || 'School photo'} className="w-full aspect-video object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Teams by season */}
            {Object.entries(sportsBySeason).map(([season, seasonTeams]) => (
              <div key={season} className="card p-4">
                <div className="section-label mb-2">{season} Sports</div>
                <div className="space-y-1">
                  {seasonTeams?.map(team => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.slug}`}
                      className="flex items-center gap-2 py-1.5 text-sm hover:text-white transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span>{team.sport?.sport_name}</span>
                      {team.sport?.gender && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          ({team.sport.gender})
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {/* Sponsor */}
            {sponsor ? (
              <a href={sponsor.website_url || '#'} target="_blank" rel="noopener noreferrer" className="sponsor-block flex-col gap-1">
                <span className="section-label">Sponsored By</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{sponsor.business_name}</span>
              </a>
            ) : (
              <Link href="/advertise" className="sponsor-block flex-col gap-1">
                <span className="section-label">Advertise Here</span>
                <span className="text-xs" style={{ color: 'var(--accent-bright)' }}>Sponsor a school page →</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
