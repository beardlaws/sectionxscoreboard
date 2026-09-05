export const revalidate = 60
import { createPublicClient as createClient } from '@/lib/supabase/public'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'

type Props={params:{slug:string}}

function dateLabel(value:string){return new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}

export default async function TeamPhotosPage({params}:Props){
 const supabase=createClient()
 const {data:team}=await supabase.from('teams').select('id,team_name,slug,sport_id,school:schools(school_name,slug,primary_color,secondary_color),sport:sports(sport_name)').eq('slug',params.slug).single()
 if(!team)notFound()
 const school:any=team.school,sport:any=team.sport
 const {data:season}=await supabase.from('seasons').select('id,name').eq('is_active',true).single()
 let gameQuery=supabase.from('games').select(`id,game_date,game_time,status,home_team_id,away_team_id,home_team:teams!games_home_team_id_fkey(team_name,school:schools(school_name)),away_team:teams!games_away_team_id_fkey(team_name,school:schools(school_name)),external_home:external_opponents!games_external_home_opponent_id_fkey(name),external_away:external_opponents!games_external_away_opponent_id_fkey(name)`).or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`).eq('sport_id',team.sport_id)
 if(season)gameQuery=gameQuery.eq('season_id',season.id)
 const {data:gamesData}=await gameQuery.order('game_date',{ascending:false})
 const games:any[]=gamesData||[],gameIds=games.map(g=>g.id)
 let photos:any[]=[]
 if(gameIds.length){const {data}=await supabase.from('photos').select('id,game_id,photo_url,caption,photographer_credit_name,created_at').eq('approved',true).in('game_id',gameIds).order('created_at',{ascending:false});photos=data||[]}
 const byGame=new Map<string,any[]>()
 for(const photo of photos){const list=byGame.get(photo.game_id)||[];list.push(photo);byGame.set(photo.game_id,list)}
 const albums=games.map(game=>({game,photos:byGame.get(game.id)||[]})).filter(x=>x.photos.length)
 const latest=photos.slice(0,8)
 const opponent=(g:any)=>{const home=g.home_team?.school?.school_name||g.external_home?.name||'TBD',away=g.away_team?.school?.school_name||g.external_away?.name||'TBD';return g.home_team_id===team.id?away:home}
 return <PublicLayout><main className="max-w-5xl mx-auto px-4 py-6">
  <Link href={`/teams/${team.slug}`} className="text-xs font-bold text-blue-400 hover:text-blue-300">← Back to {team.team_name}</Link>
  <section className="mt-4 rounded-2xl p-5 sm:p-7 border border-white/10" style={{background:`linear-gradient(135deg,${school?.primary_color||'#1e3a5f'}55,${school?.secondary_color||'#0f172a'}33)`}}>
   <div className="text-xs uppercase tracking-[.18em] text-slate-400 font-black">{season?.name||'Current Season'} · Photo Archive</div>
   <h1 className="mt-1 text-3xl sm:text-4xl font-black text-white" style={{fontFamily:'var(--font-display)'}}>{school?.school_name} {sport?.sport_name}</h1>
   <p className="mt-2 text-sm text-slate-400">Every approved game photo for this team, automatically organized by game.</p>
   <div className="mt-4 flex gap-3 text-xs font-bold"><span className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5">{photos.length} photo{photos.length===1?'':'s'}</span><span className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5">{albums.length} game album{albums.length===1?'':'s'}</span></div>
  </section>
  {latest.length>0&&<section className="mt-7"><div className="flex items-center gap-3 mb-3"><h2 className="text-sm uppercase tracking-widest font-black text-blue-300">Latest Photos</h2><div className="h-px flex-1 bg-white/10"/></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{latest.map(p=><Link key={p.id} href={`/game-center/${p.game_id}`} className="block overflow-hidden rounded-xl border border-white/10 bg-black/20"><img src={p.photo_url} alt={p.caption||`${team.team_name} photo`} className="w-full aspect-square object-cover"/></Link>)}</div></section>}
  <section className="mt-8"><div className="flex items-center gap-3 mb-3"><h2 className="text-sm uppercase tracking-widest font-black text-slate-300">Game Albums</h2><div className="h-px flex-1 bg-white/10"/></div>{albums.length?<div className="space-y-4">{albums.map(({game,photos:albumPhotos})=><Link key={game.id} href={`/game-center/${game.id}`} className="block rounded-2xl overflow-hidden border border-white/10 bg-white/[0.025] hover:bg-white/[0.04] transition-colors"><div className="grid grid-cols-[120px_1fr] sm:grid-cols-[180px_1fr]"><div className="relative"><img src={albumPhotos[0].photo_url} alt="Game album cover" className="w-full h-full min-h-[120px] object-cover"/><div className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-black text-white">{albumPhotos.length} PHOTO{albumPhotos.length===1?'':'S'}</div></div><div className="p-4 sm:p-5 flex flex-col justify-center"><div className="text-xs uppercase tracking-widest text-slate-500 font-bold">{dateLabel(game.game_date)}{game.status?` · ${game.status}`:''}</div><div className="mt-1 text-lg sm:text-xl font-black text-white" style={{fontFamily:'var(--font-display)'}}>{game.home_team_id===team.id?'vs':'at'} {opponent(game)}</div><div className="mt-2 text-xs text-blue-400 font-bold">Open game album →</div></div></div></Link>)}</div>:<div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center"><div className="text-3xl">📷</div><h3 className="mt-2 font-black text-white">No approved game photos yet</h3><p className="mt-1 text-sm text-slate-500">When photos are approved for this team's games, albums will appear here automatically.</p><Link href="/submit-photo" className="inline-block mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white">Submit Photos</Link></div>}</section>
 </main></PublicLayout>
}
