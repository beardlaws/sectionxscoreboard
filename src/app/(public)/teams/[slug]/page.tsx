import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { calculateStandings } from '@/lib/standings'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import { getPublicContentRepository } from '@/lib/data/runtime-public-content-repository'

export const dynamic = 'force-dynamic'
type Props={params:Promise<{slug:string}>}

function formatDate(date:string){return new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function formatTime(t:string|null){if(!t)return'TBD';const[h,m]=t.split(':').map(Number);return`${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`}
function labelSport(s:any){if(!s)return'Sport';const n=String(s.sport_name||''),g=String(s.gender||'');return(g==='Boys'||g==='Girls')&&!n.toLowerCase().startsWith(g.toLowerCase())?`${g} ${n}`:n}

export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params
 const team=await getSportsRepository().getTeamBySlug(slug)
 if(!team)return{title:'Team Not Found | Section X Scoreboard'}
 return{title:`${team.school?.school_name||''} ${labelSport(team.sport)} | Section X Scoreboard`,description:`${team.team_name} scores, schedule, roster and standings.`}
}

export default async function TeamPage({params}:Props){
 const {slug}=await params
 const repo=getSportsRepository(),content=getPublicContentRepository()
 const team=await repo.getTeamBySlug(slug)
 if(!team)notFound()
 const school=team.school,sport=team.sport
 const activeSeason=await repo.getActiveSeason()
 const teamSportId=sport?.id||team.sport_id
 const [games,teamSeason,roster,coaches,allFinals,sportTeamSeasons]=await Promise.all([
   repo.getGamesForTeam(team.id,activeSeason?.id||null),
   activeSeason?repo.getTeamSeason(team.id,activeSeason.id):Promise.resolve(null),
   activeSeason?content.getTeamRoster(team.id,activeSeason.id):Promise.resolve([]),
   activeSeason?content.getTeamCoaches(team.id,activeSeason.id):Promise.resolve([]),
   activeSeason&&teamSportId?repo.getFinalGamesForSport(teamSportId,activeSeason.id):Promise.resolve([]),
   activeSeason&&teamSportId?repo.getTeamSeasonsForSport(teamSportId,activeSeason.id):Promise.resolve([]),
 ])
 const finals=(games||[]).filter((g:any)=>g.status==='Final')
 const isGolf=String(sport?.sport_name||'').toLowerCase().includes('golf')
 let wins=0,losses=0,ties=0
 for(const g of finals){if(g.home_score==null||g.away_score==null)continue;const mine=g.home_team_id===team.id?g.home_score:g.away_score;const opp=g.home_team_id===team.id?g.away_score:g.home_score;if(mine===opp)ties++;else if(isGolf?mine<opp:mine>opp)wins++;else losses++}
 const upcoming=(games||[]).filter((g:any)=>['Scheduled','Postponed'].includes(g.status)).sort((a:any,b:any)=>String(a.game_date).localeCompare(String(b.game_date)))
 const results=[...finals].sort((a:any,b:any)=>String(b.game_date).localeCompare(String(a.game_date)))
 const form=results.slice(0,5).map((g:any)=>{if(g.home_score==null||g.away_score==null)return'U';const mine=g.home_team_id===team.id?g.home_score:g.away_score;const opp=g.home_team_id===team.id?g.away_score:g.home_score;if(mine===opp)return'T';return(isGolf?mine<opp:mine>opp)?'W':'L'}).reverse()
 let standingsPosition:null|number=null,standingsTotal:null|number=null,standingsLabel:null|string=null
 if(activeSeason&&teamSportId){const standings=calculateStandings(allFinals||[],sportTeamSeasons||[],sport?.sport_name);const division=teamSeason?.division||null;const group=standings.filter((r:any)=>!division||r.division===division);const idx=group.findIndex((r:any)=>r.team_id===team.id);if(idx>=0){standingsPosition=idx+1;standingsTotal=group.length;standingsLabel=division?`${division} Div`:'Overall'}}
 const opponent=(g:any)=>g.home_team_id===team.id?(g.away_team?.school?.school_name||g.external_away?.name||'TBD'):(g.home_team?.school?.school_name||g.external_home?.name||'TBD')
 const resultLine=(g:any)=>{const mine=g.home_team_id===team.id?g.home_score:g.away_score;const opp=g.home_team_id===team.id?g.away_score:g.home_score;return`${mine} - ${opp}`}
 const primary=school?.primary_color||'#1e3a5f',secondary=school?.secondary_color||'#0f172a'
 return <PublicLayout><div className="max-w-4xl mx-auto px-4 py-6">
   <div className="rounded-2xl overflow-hidden mb-6" style={{background:`linear-gradient(135deg,${primary},${secondary}cc)`}}><div className="px-6 py-7"><Link href={`/schools/${school?.slug}`} className="text-xs text-white/60">{school?.school_name}</Link><h1 className="text-3xl md:text-4xl font-black text-white mt-2" style={{fontFamily:'var(--font-display)'}}>{team.team_name}</h1><div className="flex items-end justify-between gap-4 mt-3"><div><p className="text-white/60 text-sm">{activeSeason?.name||''}</p><div className="flex gap-2 flex-wrap mt-3">{teamSeason?.division&&<span className="px-2.5 py-1 rounded-full text-xs bg-black/20 text-white/70">{teamSeason.division} Division</span>}{teamSeason?.class&&<span className="px-2.5 py-1 rounded-full text-xs bg-black/20 text-white/70">Class {teamSeason.class}</span>}{standingsPosition&&<span className="px-2.5 py-1 rounded-full text-xs bg-yellow-500/10 text-yellow-300">#{standingsPosition} of {standingsTotal} · {standingsLabel}</span>}</div></div><div className="text-right"><div className="text-4xl font-black text-white">{wins}-{losses}{ties?`-${ties}`:''}</div><div className="text-xs text-white/50 uppercase">Record</div></div></div>{form.length>0&&<div className="flex gap-1.5 mt-4">{form.map((r,i)=><span key={i} className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-xs font-black text-white">{r}</span>)}</div>}</div></div>
   {coaches.length>0&&<section className="mb-7"><div className="text-xs uppercase tracking-widest text-slate-500 mb-2">Coaching Staff</div><div className="flex flex-wrap gap-2">{coaches.map((c:any)=><div key={c.id} className="rounded-lg px-3 py-2 bg-white/[.03] border border-white/[.07]"><span className="font-bold text-white">{c.coach?.display_name}</span>{c.title&&<span className="text-slate-500 text-xs ml-2">{c.title}</span>}</div>)}</div></section>}
   <div className="grid lg:grid-cols-2 gap-6 mb-7"><section><h2 className="font-black text-white uppercase tracking-widest text-sm mb-3">Upcoming</h2>{upcoming.length?<div className="space-y-2">{upcoming.slice(0,10).map((g:any)=><Link key={g.id} href={`/game-center/${g.id}`} className="block rounded-xl p-4 bg-white/[.03] border border-white/[.08]"><div className="text-xs text-slate-500">{formatDate(g.game_date)} · {formatTime(g.game_time)}</div><div className="font-black text-white mt-1">{g.home_team_id===team.id?'vs':'@'} {opponent(g)}</div></Link>)}</div>:<div className="rounded-xl p-5 text-sm text-slate-500 border border-white/[.06]">No upcoming games loaded.</div>}</section><section><h2 className="font-black text-white uppercase tracking-widest text-sm mb-3">Recent Results</h2>{results.length?<div className="space-y-2">{results.slice(0,10).map((g:any)=><Link key={g.id} href={`/game-center/${g.id}`} className="flex items-center justify-between gap-3 rounded-xl p-4 bg-white/[.03] border border-white/[.08]"><div><div className="text-xs text-slate-500">{formatDate(g.game_date)}</div><div className="font-black text-white mt-1">{opponent(g)}</div></div><div className="text-xl font-black text-white">{resultLine(g)}</div></Link>)}</div>:<div className="rounded-xl p-5 text-sm text-slate-500 border border-white/[.06]">No final results yet.</div>}</section></div>
   <section><div className="flex items-center justify-between mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm">Roster</h2><span className="text-xs text-slate-500">{roster.length} athletes</span></div>{roster.length?<div className="rounded-xl overflow-hidden border border-white/[.07]">{roster.map((r:any)=><Link key={r.id} href={r.athlete?.slug?`/athletes/${r.athlete.slug}`:'#'} className="grid grid-cols-[50px_1fr_auto] gap-3 items-center px-4 py-3 border-b border-white/[.05] last:border-0"><span className="text-slate-500 font-black">{r.jersey_number?`#${r.jersey_number}`:'-'}</span><div><div className="font-bold text-white">{r.athlete?.display_name||'Athlete'}</div><div className="text-xs text-slate-500">{[r.position,r.height].filter(Boolean).join(' · ')}</div></div><span className="text-xs text-slate-400">{r.class_year||''}</span></Link>)}</div>:<div className="rounded-xl p-6 text-sm text-slate-500 bg-black/20 border border-white/[.06]">No published roster yet.</div>}</section>
 </div></PublicLayout>
}
