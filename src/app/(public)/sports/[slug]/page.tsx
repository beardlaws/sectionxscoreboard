// src/app/(public)/sports/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { ALL_SPORTS } from '@/lib/constants'
import { calculateStandings } from '@/lib/standings'
import ScoreCard from '@/components/scores/ScoreCard'
import { GameWithTeams } from '@/types'
import { Trophy } from 'lucide-react'
import PublicLayout from '@/components/layout/PublicLayout'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import { getPublicContentRepository } from '@/lib/data/runtime-public-content-repository'
import { sectionXDate } from '@/lib/sectionx-time'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const sport = ALL_SPORTS.find(s => s.slug === slug)
  if (!sport) return {}
  return {
    title: `${sport.name} Scores & Standings`,
    description: `Section X ${sport.name} scores, schedules, and standings. Northern NY high school sports.`,
  }
}

const SEASON_START: Record<string, string> = { Fall: 'August 2026', Winter: 'December 2026' }
const SEASON_ICONS: Record<string, string> = { Fall: '🍂', Winter: '❄️' }

export const dynamic = 'force-dynamic'

export default async function SportPage({ params }: Props) {
  const { slug } = await params
  const sport = ALL_SPORTS.find(s => s.slug === slug)
  if (!sport) notFound()

  const repo = getSportsRepository()
  const contentRepo = getPublicContentRepository()
  const [activeSeason, sportRecord] = await Promise.all([
    repo.getActiveSeason(),
    repo.getSportBySlug(slug),
  ])

  if (!sportRecord) {
    const startDate = SEASON_START[sport.season] || 'this fall'
    const icon = SEASON_ICONS[sport.season] || '🏆'
    return (
      <PublicLayout><div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-6xl mb-6">{icon}</p><h1 className="text-3xl font-black text-white mb-3" style={{ fontFamily:'var(--font-display)',letterSpacing:'0.04em' }}>{sport.name}</h1>
        <div className="rounded-2xl p-8 border border-white/8 inline-block" style={{background:'rgba(8,12,20,0.7)'}}>
          <p className="text-xl font-black text-blue-400 mb-2" style={{fontFamily:'var(--font-display)'}}>Season Starts {startDate}</p>
          <p className="text-slate-400 text-sm">{sport.name} scores, standings, and schedules will appear here once the season begins.</p>
        </div>
      </div></PublicLayout>
    )
  }

  const twoWeeksAgo = new Date(Date.now()-14*86400000).toISOString().split('T')[0]
  const twoWeeksAhead = new Date(Date.now()+14*86400000).toISOString().split('T')[0]
  const [gamesData, allGames, sportTeamSeasons, sportSponsor] = activeSeason ? await Promise.all([
    repo.getGamesForSport(sportRecord.id, activeSeason.id, twoWeeksAgo, twoWeeksAhead),
    repo.getFinalGamesForSport(sportRecord.id, activeSeason.id),
    repo.getTeamSeasonsForSport(sportRecord.id, activeSeason.id),
    contentRepo.getSportSponsor(sportRecord.id, sectionXDate()),
  ]) : [[], [], [], null]

  const standings = calculateStandings((allGames as GameWithTeams[]) || [], sportTeamSeasons || [], sportRecord.sport_name)
  const games = (gamesData as GameWithTeams[]) || []
  const recentGames = games.filter(g=>g.status==='Final')
  const upcomingGames = games.filter(g=>g.status==='Scheduled'||g.status==='Postponed').reverse()
  const isPreseason = standings.length>0 && standings.every(row=>row.wins===0&&row.losses===0&&row.ties===0)

  return (
    <PublicLayout><div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-4"><div className="flex items-center gap-2 mb-1"><Link href="/" className="text-slate-400 hover:text-white text-sm">Home</Link><span className="text-slate-600">/</span><span className="text-slate-300 text-sm">{sport.name}</span></div><h1 className="text-3xl font-bold font-display text-white">{sport.name}</h1>{activeSeason&&<p className="text-slate-400 text-sm mt-1">{activeSeason.name}</p>}</div>
      {sportSponsor&&<a href={sportSponsor.website_url||'#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5" style={{background:'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(8,12,20,0.8))',border:'1px solid rgba(37,99,235,0.2)'}}>{sportSponsor.logo_url&&<img src={sportSponsor.logo_url} alt={sportSponsor.business_name} className="w-8 h-8 object-contain rounded flex-shrink-0"/>}<div className="flex-1"><p className="text-xs text-slate-500">{sport.name.toUpperCase()} COVERAGE BY</p><p className="font-black text-white text-sm">{sportSponsor.business_name}</p></div></a>}
      {games.length===0&&standings.length===0?<div className="card p-10 text-center text-slate-400">No games or standings loaded yet.</div>:<div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="lg:col-span-2 space-y-6">{upcomingGames.length>0&&<section><h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Upcoming</h2><div className="space-y-2">{upcomingGames.slice(0,10).map(game=><ScoreCard key={game.id} game={game} compact />)}</div></section>}{recentGames.length>0&&<section><h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Results</h2><div className="space-y-2">{recentGames.slice(0,20).map(game=><ScoreCard key={game.id} game={game} compact />)}</div></section>}</div><div>{standings.length>0&&<div className="card p-4"><h2 className="text-white font-bold flex items-center gap-2 mb-4"><Trophy size={16} className="text-yellow-400"/> Standings</h2>{isPreseason&&<p className="text-xs text-blue-300 mb-3">Preseason · All teams begin 0-0</p>}<div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-slate-400 border-b border-white/10"><th className="text-left pb-2 font-medium">Team</th><th className="text-center pb-2 font-medium">W</th><th className="text-center pb-2 font-medium">L</th><th className="text-center pb-2 font-medium">PCT</th></tr></thead><tbody>{standings.slice(0,16).map((row:any,i:number)=><tr key={row.team_id} className="border-b border-white/5"><td className="py-1.5 pr-2">{!isPreseason&&<span className="text-slate-500 mr-1.5">{i+1}.</span>}<Link href={`/teams/${row.slug}`} className="text-white hover:text-ice">{row.school_name||row.team_name}</Link></td><td className="text-center text-white font-mono">{row.wins}</td><td className="text-center text-white font-mono">{row.losses}</td><td className="text-center text-slate-300 font-mono">{row.win_pct.toFixed(3)}</td></tr>)}</tbody></table></div><Link href={`/standings?sport=${sportRecord.slug}`} className="block text-center text-xs text-blue-400 mt-3">Full Standings →</Link></div>}</div></div>}
    </div></PublicLayout>
  )
}
