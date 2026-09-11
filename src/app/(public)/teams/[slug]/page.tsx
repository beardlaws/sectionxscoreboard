import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { calculateStandings } from '@/lib/standings'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import { getPublicContentRepository } from '@/lib/data/runtime-public-content-repository'

export const dynamic = 'force-dynamic'
type Props={params:Promise<{slug:string}>}

function safeDate(value:string){const clean=String(value||'').slice(0,10);const d=new Date(`${clean}T12:00:00`);return Number.isNaN(d.getTime())?clean:d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function formatTime(t:string|null){if(!t)return'TBD';const[h,m]=String(t).split(':').map(Number);if(Number.isNaN(h)||Number.isNaN(m))return t;return`${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`}
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

 return <PublicLayout><div className="max-w-3xl mx-auto px-4 py-6">
  <div className="rounded-2xl overflow-hidden mb-6 relative" style={{background:`linear-gradient(135deg,${primary}ee 0%,${secondary}cc 100%)`}}>
   <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle at 20% 20%, white 0, transparent 1px)',backgroundSize:'12px 12px'}} />
   <div className="relative px-6 pt-5 pb-6">
    <div className="flex items-center gap-1.5 text-xs text-white/50 mb-3"><Link href={`/schools/${school?.slug}`} className="hover:text-white transition-colors">{school?.school_name}</Link><span>/</span><span>{labelSport(sport)}</span></div>
    <div className="flex items-end justify-between gap-4">
     <div><h1 className="text-3xl md:text-4xl font-black text-white leading-none" style={{fontFamily:'var(--font-display)',letterSpacing:'-0.01em'}}>{team.team_name}</h1>{activeSeason&&<p className="text-white/60 text-sm mt-1">{activeSeason.name}</p>}{form.length>0&&<div className="flex items-center gap-1.5 mt-3"><span className="text-white/40 text-xs mr-1">Last {form.length}:</span>{form.map((r,i)=><span key={i} className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{background:r==='W'?'rgba(34,197,94,.3)':r==='L'?'rgba(239,68,68,.3)':'rgba(255,255,255,.15)',color:r==='W'?'#4ade80':r==='L'?'#f87171':'#94a3b8',fontFamily:'var(--font-display)'}}>{r}</span>)}</div>}</div>
     <div className="flex items-end gap-3 flex-shrink-0"><div className="text-center"><div className="text-5xl font-black text-white leading-none" style={{fontFamily:'var(--font-display)'}}>{wins}</div><div className="text-xs text-white/50 uppercase tracking-widest mt-1">W</div></div><div className="text-white/30 text-3xl mb-1">-</div><div className="text-center"><div className="text-5xl font-black text-white leading-none" style={{fontFamily:'var(--font-display)'}}>{losses}</div><div className="text-xs text-white/50 uppercase tracking-widest mt-1">L</div></div>{ties>0&&<><div className="text-white/30 text-3xl mb-1">-</div><div className="text-center"><div className="text-5xl font-black text-white leading-none" style={{fontFamily:'var(--font-display)'}}>{ties}</div><div className="text-xs text-white/50 uppercase tracking-widest mt-1">T</div></div></>}</div>
    </div>
    <div className="flex items-center gap-2 mt-4 flex-wrap">{teamSeason?.division&&<span className="px-2.5 py-1 rounded-full text-xs font-bold text-white/70 bg-white/10">{teamSeason.division} Division</span>}{teamSeason?.class&&<span className="px-2.5 py-1 rounded-full text-xs font-bold text-white/70 bg-white/10">Class {teamSeason.class}</span>}{standingsPosition&&<span className="px-2.5 py-1 rounded-full text-xs font-bold text-yellow-400" style={{background:'rgba(234,179,8,.15)',border:'1px solid rgba(234,179,8,.25)'}}>#{standingsPosition} of {standingsTotal} · {standingsLabel}</span>}<Link href={`/standings?sport=${sport?.slug||''}`} className="px-2.5 py-1 rounded-full text-xs font-bold text-blue-400 hover:text-blue-300" style={{background:'rgba(37,99,235,.15)'}}>Full Standings →</Link></div>
   </div>
  </div>

  <div className="flex items-center gap-2 flex-wrap mb-6"><a href="#schedule" className="px-3 py-1.5 rounded-full text-xs font-black text-slate-300 bg-white/[.05] border border-white/[.08]">Schedule</a><a href="#roster" className="px-3 py-1.5 rounded-full text-xs font-black text-slate-300 bg-white/[.05] border border-white/[.08]">Roster {roster.length?`· ${roster.length}`:''}</a><a href="#coaches" className="px-3 py-1.5 rounded-full text-xs font-black text-slate-300 bg-white/[.05] border border-white/[.08]">Coaches {coaches.length?`· ${coaches.length}`:''}</a><Link href={`/teams/${team.slug}/photos`} className="px-3 py-1.5 rounded-full text-xs font-black text-blue-300 bg-blue-500/10 border border-blue-400/20">Photos</Link></div>

  <section id="schedule" className="mb-7 scroll-mt-24"><div className="grid md:grid-cols-2 gap-6"><div><div className="flex items-center justify-between mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm">Upcoming</h2><span className="text-xs text-slate-500">{upcoming.length}</span></div>{upcoming.length?<div className="rounded-xl overflow-hidden border border-white/[.08]">{upcoming.map((g:any)=><Link key={g.id} href={`/game-center/${g.id}`} className="block px-4 py-3 border-b border-white/[.06] last:border-0 hover:bg-white/[.03]"><div className="flex items-start justify-between gap-4"><div><div className="text-xs text-slate-500">{g.home_team_id===team.id?'vs':'@'}</div><div className="font-black text-white mt-0.5">{opponent(g)}</div>{g.status==='Postponed'&&<div className="text-[10px] font-black text-orange-300 uppercase mt-1">Postponed</div>}</div><div className="text-right"><div className="text-xs text-slate-500">{safeDate(g.game_date)}</div><div className="text-xs font-black text-blue-400 mt-1">{formatTime(g.game_time)}</div></div></div></Link>)}</div>:<div className="rounded-xl p-5 text-sm text-slate-500 border border-white/[.06]">No upcoming games loaded.</div>}</div>
  <div><div className="flex items-center justify-between mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm">Recent Results</h2><span className="text-xs text-slate-500">{results.length}</span></div>{results.length?<div className="rounded-xl overflow-hidden border border-white/[.08]">{results.map((g:any)=><Link key={g.id} href={`/game-center/${g.id}`} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[.06] last:border-0 hover:bg-white/[.03]"><div><div className="text-xs text-slate-500">{safeDate(g.game_date)}</div><div className="font-black text-white mt-0.5">{opponent(g)}</div></div><div className="text-xl font-black text-white">{resultLine(g)}</div></Link>)}</div>:<div className="rounded-xl p-5 text-sm text-slate-500 border border-white/[.06]">No final results yet.</div>}</div></div></section>

  <section id="roster" className="mb-7 scroll-mt-24"><div className="flex items-center justify-between mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm">Roster</h2><span className="text-xs text-slate-500">{roster.length} athletes</span></div>{roster.length?<div className="rounded-xl overflow-hidden border border-white/[.07]">{roster.map((r:any)=><Link key={r.id} href={r.athlete?.slug?`/athletes/${r.athlete.slug}`:'#'} className="grid grid-cols-[50px_1fr_auto] gap-3 items-center px-4 py-3 border-b border-white/[.05] last:border-0"><span className="text-slate-500 font-black">{r.jersey_number?`#${r.jersey_number}`:'-'}</span><div><div className="font-bold text-white">{r.athlete?.display_name||'Athlete'}</div><div className="text-xs text-slate-500">{[r.position,r.height].filter(Boolean).join(' · ')}</div></div><span className="text-xs text-slate-400">{r.class_year||''}</span></Link>)}</div>:<div className="rounded-xl p-6 text-sm text-slate-500 bg-black/20 border border-white/[.06]">No published roster yet.</div>}</section>

  <section id="coaches" className="scroll-mt-24"><div className="flex items-center justify-between mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm">Coaching Staff</h2><span className="text-xs text-slate-500">{coaches.length}</span></div>{coaches.length?<div className="flex flex-wrap gap-2">{coaches.map((c:any)=><div key={c.id} className="rounded-lg px-3 py-2 bg-white/[.03] border border-white/[.07]"><span className="font-bold text-white">{c.coach?.display_name||'Coach'}</span>{c.title&&<span className="text-slate-500 text-xs ml-2">{c.title}</span>}</div>)}</div>:<div className="rounded-xl p-5 text-sm text-slate-500 border border-white/[.06]">No coaching staff published yet.</div>}</section>
 </div></PublicLayout>
}
