// src/app/(public)/athletes/[slug]/page.tsx

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'

export const revalidate = 0

interface PageProps {
  params: {
    slug: string
  }
}

function normalizeJoinedRecord<T = any>(
  value: T | T[] | null | undefined
): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function sportDisplayName(sport: any) {
  if (!sport) return 'Sport'

  const sportName = sport.sport_name || ''
  const gender = sport.gender || ''

  if (
    (gender === 'Boys' || gender === 'Girls') &&
    !sportName.toLowerCase().startsWith(gender.toLowerCase())
  ) {
    return `${gender} ${sportName}`
  }

  return sportName
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const supabase = createClient()

  const { data: athlete } = await supabase
    .from('athletes')
    .select(`
      display_name,
      school:schools(
        school_name
      )
    `)
    .eq('slug', params.slug)
    .maybeSingle()

  if (!athlete) {
    return {
      title: 'Athlete Not Found | Section X Scoreboard',
    }
  }

  const school = normalizeJoinedRecord<any>((athlete as any).school)

  return {
    title: `${athlete.display_name} | ${school?.school_name || 'Section X'} Athlete`,
    description: `${athlete.display_name} teams, roster history, and approved photos on Section X Scoreboard.`,
  }
}

export default async function AthletePage({
  params,
}: PageProps) {
  const supabase = createClient()

  const { data: athlete, error } = await supabase
    .from('athletes')
    .select(`
      id,
      first_name,
      last_name,
      display_name,
      slug,
      active,
      school:schools(
        id,
        school_name,
        mascot,
        slug,
        city,
        county,
        primary_color,
        secondary_color,
        logo_url
      )
    `)
    .eq('slug', params.slug)
    .maybeSingle()

  if (error || !athlete) {
    notFound()
  }

  const school = normalizeJoinedRecord<any>((athlete as any).school)

  const [{ data: rosterRows }, { data: photoTags }] = await Promise.all([
    supabase
      .from('roster_entries')
      .select(`
        id,
        jersey_number,
        class_year,
        position,
        height,
        active,
        imported_at,
        team:teams(
          id,
          team_name,
          slug,
          sport:sports(
            id,
            sport_name,
            gender,
            slug,
            season_type
          )
        ),
        season:seasons(
          id,
          name,
          year,
          season_type,
          is_active
        )
      `)
      .eq('athlete_id', athlete.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('photo_athletes')
      .select(`
        photo:photos(
          id,
          photo_url,
          caption,
          photographer_credit_name,
          game_id,
          created_at
        )
      `)
      .eq('athlete_id', athlete.id),
  ])

  const memberships = (rosterRows || [])
    .map((row: any) => {
      const team = normalizeJoinedRecord<any>(row.team)
      const sport = normalizeJoinedRecord<any>(team?.sport)
      const season = normalizeJoinedRecord<any>(row.season)

      return {
        ...row,
        team,
        sport,
        season,
      }
    })
    .filter((row: any) => row.team && row.season)

  memberships.sort((a: any, b: any) => {
    if (a.season?.is_active && !b.season?.is_active) return -1
    if (!a.season?.is_active && b.season?.is_active) return 1

    const yearDiff = (b.season?.year || 0) - (a.season?.year || 0)
    if (yearDiff !== 0) return yearDiff

    return sportDisplayName(a.sport).localeCompare(
      sportDisplayName(b.sport)
    )
  })

  const currentMemberships = memberships.filter(
    (row: any) => row.active && row.season?.is_active
  )

  const history = memberships.filter(
    (row: any) => !row.season?.is_active || !row.active
  )

  const photos = (photoTags || [])
    .map((row: any) => normalizeJoinedRecord<any>(row.photo))
    .filter(Boolean)
    .sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')))

  const colors = {
    primary: school?.primary_color || '#1e3a5f',
    secondary: school?.secondary_color || '#0f172a',
  }

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div
          className="rounded-2xl p-6 md:p-8 mb-6"
          style={{
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary}cc)`,
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <div className="flex items-center justify-between gap-5">
            <div className="min-w-0">
              {school && (
                <Link
                  href={`/schools/${school.slug}`}
                  className="text-xs text-white/60 hover:text-white transition-colors"
                >
                  {school.school_name}
                </Link>
              )}

              <h1
                className="text-4xl md:text-5xl font-black text-white mt-2 leading-none"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {athlete.display_name}
              </h1>

              {school && (
                <p
                  className="text-white/70 font-bold mt-2"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {school.mascot}
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                <span className="text-xs rounded-full px-3 py-1 bg-black/20 text-white/70">{currentMemberships.length} current team{currentMemberships.length === 1 ? '' : 's'}</span>
                <span className="text-xs rounded-full px-3 py-1 bg-black/20 text-white/70">{photos.length} approved photo{photos.length === 1 ? '' : 's'}</span>
              </div>
            </div>

            {school?.logo_url && (
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex-shrink-0 overflow-hidden"
                style={{
                  background: 'rgba(0,0,0,0.22)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <img
                  src={school.logo_url}
                  alt=""
                  className="w-full h-full object-contain p-2"
                />
              </div>
            )}
          </div>
        </div>

        <section className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <h2
              className="text-sm font-black uppercase tracking-widest text-blue-400"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Current Teams
            </h2>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>

          {currentMemberships.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentMemberships.map((row: any) => (
                <Link
                  key={row.id}
                  href={`/teams/${row.team.slug}`}
                  className="rounded-xl p-4 transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="text-xs text-slate-500 uppercase tracking-wider">
                    {row.season.name}
                  </div>

                  <div
                    className="text-lg font-black text-white mt-1"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {sportDisplayName(row.sport)}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    {row.jersey_number && (
                      <span className="text-xs rounded-full px-2 py-1 bg-blue-500/10 text-blue-300">
                        #{row.jersey_number}
                      </span>
                    )}
                    {row.class_year && <span className="text-xs rounded-full px-2 py-1 bg-white/5 text-slate-400">{row.class_year}</span>}
                    {row.position && <span className="text-xs rounded-full px-2 py-1 bg-white/5 text-slate-400">{row.position}</span>}
                    {row.height && <span className="text-xs rounded-full px-2 py-1 bg-white/5 text-slate-400">{row.height}</span>}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-sm text-slate-500" style={{ background: 'rgba(8,12,20,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}>
              No current team membership is published yet.
            </div>
          )}
        </section>

        <section className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-blue-400" style={{ fontFamily: 'var(--font-display)' }}>
              Photo Gallery
            </h2>
            <div className="flex-1 h-px bg-white/[0.06]" />
            <span className="text-xs text-slate-500">{photos.length}</span>
          </div>

          {photos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((photo: any) => {
                const card = (
                  <div className="group rounded-xl overflow-hidden border border-white/10 bg-white/[0.02] h-full">
                    <div className="aspect-[4/3] overflow-hidden bg-black/30">
                      <img src={photo.photo_url} alt={photo.caption || `${athlete.display_name} photo`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    </div>
                    <div className="p-3">
                      {photo.caption && <div className="text-xs text-slate-300 line-clamp-2">{photo.caption}</div>}
                      <div className="text-[10px] text-slate-500 mt-1">Photo: {photo.photographer_credit_name || 'Section X contributor'}</div>
                    </div>
                  </div>
                )
                return photo.game_id ? <Link key={photo.id} href={`/game-center/${photo.game_id}`}>{card}</Link> : <div key={photo.id}>{card}</div>
              })}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-sm text-slate-500" style={{ background: 'rgba(8,12,20,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}>
              No approved photos are tagged to this athlete yet. Approved game photos will appear here automatically when the athlete is tagged.
            </div>
          )}
        </section>

        {history.length > 0 && (
          <section className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400" style={{ fontFamily: 'var(--font-display)' }}>Team History</h2>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(8,12,20,0.55)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {history.map((row: any) => (
                <Link key={row.id} href={`/teams/${row.team.slug}`} className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.025]">
                  <div><div className="font-bold text-white">{sportDisplayName(row.sport)}</div><div className="text-xs text-slate-500">{row.season.name}</div></div>
                  <div className="text-xs text-slate-500">{row.class_year || ''}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="rounded-xl p-4 text-xs text-slate-600" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          Athlete information comes from publicly published team rosters. Only approved photos and approved athlete tags are shown publicly.
        </div>
      </div>
    </PublicLayout>
  )
}
