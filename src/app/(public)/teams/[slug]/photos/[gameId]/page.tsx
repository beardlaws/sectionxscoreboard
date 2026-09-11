export const revalidate = 60

import { notFound } from 'next/navigation'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { PhotoGalleryGrid } from '@/components/PhotoLightbox'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import { getTeamPhotoRepository } from '@/lib/data/runtime-team-photo-repository'

type Props = { params: Promise<{ slug: string; gameId: string }> }

function dateLabel(value: string) {
  const clean = String(value || '').slice(0, 10)
  const date = new Date(`${clean}T12:00:00`)
  return Number.isNaN(date.getTime()) ? clean : date.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export default async function TeamGamePhotoAlbumPage({ params }: Props) {
  const { slug, gameId } = await params
  const sportsRepository = getSportsRepository()
  const photoRepository = getTeamPhotoRepository()
  const team = await sportsRepository.getTeamBySlug(slug)
  if (!team) notFound()

  const season = await sportsRepository.getActiveSeason()
  const games = await sportsRepository.getGamesForTeam(team.id, season?.id || null)
  const game: any = games.find((candidate: any) => candidate.id === gameId)
  if (!game) notFound()

  const photos = (await photoRepository.getApprovedPhotosForGameIds([game.id]))
    .slice()
    .sort((a: any, b: any) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
  if (!photos.length) notFound()

  const school: any = team.school
  const sport: any = team.sport
  const home = game.home_team?.school?.school_name || game.external_home?.name || 'TBD'
  const away = game.away_team?.school?.school_name || game.external_away?.name || 'TBD'
  const opponent = game.home_team_id === team.id ? away : home
  const locationWord = game.home_team_id === team.id ? 'vs' : 'at'

  return (
    <PublicLayout>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
          <Link href={`/teams/${team.slug}/photos`} className="text-blue-400 hover:text-blue-300">← Back to {team.team_name} photos</Link>
          <span className="text-white/20">•</span>
          <Link href={`/game-center/${game.id}`} className="text-slate-400 hover:text-slate-200">Game Center</Link>
        </div>
        <section className="mt-4 rounded-2xl p-5 sm:p-7 border border-white/10" style={{background:`linear-gradient(135deg,${school?.primary_color || '#1e3a5f'}55,${school?.secondary_color || '#0f172a'}33)`}}>
          <div className="text-xs uppercase tracking-[.18em] text-slate-400 font-black">{dateLabel(game.game_date)}{game.status ? ` · ${game.status}` : ''}</div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-black text-white" style={{fontFamily:'var(--font-display)'}}>{school?.school_name} {sport?.sport_name}</h1>
          <p className="mt-2 text-lg font-black text-white/85">{locationWord} {opponent}</p>
          <div className="mt-4 inline-flex rounded-full bg-black/25 border border-white/10 px-3 py-1.5 text-xs font-bold text-white/70">{photos.length} photo{photos.length === 1 ? '' : 's'}</div>
        </section>
        <section className="mt-7">
          <div className="flex items-center gap-3 mb-4"><h2 className="text-sm uppercase tracking-widest font-black text-blue-300">Game Album</h2><div className="h-px flex-1 bg-white/10" /></div>
          <PhotoGalleryGrid photos={photos} />
        </section>
      </main>
    </PublicLayout>
  )
}
