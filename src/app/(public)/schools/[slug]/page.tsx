import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import { getPublicContentRepository } from '@/lib/data/runtime-public-content-repository'
import { sectionXDate } from '@/lib/sectionx-time'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ slug: string }> }

const SPORT_ICONS: Record<string,string> = {
  Baseball:'⚾',Softball:'🥎',Football:'🏈','Boys Basketball':'🏀','Girls Basketball':'🏀','Boys Lacrosse':'🥍','Girls Lacrosse':'🥍','Boys Hockey':'🏒','Girls Hockey':'🏒','Boys Soccer':'⚽','Girls Soccer':'⚽',Volleyball:'🏐','Boys Golf':'⛳','Girls Golf':'⛳',Swimming:'🏊','Girls Swimming':'🏊','Boys Wrestling':'🤼','Girls Wrestling':'🤼','Boys Cross Country':'🏃','Girls Cross Country':'🏃','Boys Track':'🏃','Girls Track':'🏃'
}

function formatDate(date:string){return new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function formatTime(time:string|null){if(!time)return'TBD';const[h,m]=time.split(':');const hour=Number(h);if(Number.isNaN(hour))return time;return`${hour%12||12}:${m} ${hour>=12?'PM':'AM'}`}
function sportLabel(team:any){const sport=team?.sport;if(!sport)return'';const n=String(sport.sport_name||'');const g=String(sport.gender||'');return(g==='Boys'||g==='Girls')&&!n.toLowerCase().startsWith(g.toLowerCase())?`${g} ${n}`:n}

export async function generateMetadata({params}:PageProps):Promise<Metadata>{
  const {slug}=await params
  const school=await getSportsRepository().getSchoolBySlug(slug)
  if(!school)return{title:'School Not Found'}
  return{title:`${school.school_name} ${school.mascot||''} Scores & Standings | Section X Scoreboard`,description:`${school.school_name} sports scores, standings, schedule and results on Section X Scoreboard.`}
}

export default async function SchoolPage({params}:PageProps){
  const {slug}=await params
  const repo=getSportsRepository()
  const content=getPublicContentRepository()
  const school=await repo.getSchoolBySlug(slug)
  if(!school)notFound()
  const activeSeason=await repo.getActiveSeason()
  const today=sectionXDate()
  const [allTeams,schoolSponsor]=await Promise.all([
    repo.getTeamsForSchool(school.id,activeSeason?.id||null),
    content.getSchoolSponsor(school.id,today),
  ])
  const activeTeams=(allTeams||[]).filter((t:any)=>t.active!==false&&(!t.level||String(t.level).toLowerCase()==='varsity')&&(t.active_for_season==null||t.active_for_season!==false))
  const gamesNested=await Promise.all(activeTeams.map((t:any)=>repo.getGamesForTeam(t.id,activeSeason?.id||null)))
  const gameMap=new Map<string,any>()
  for(const list of gamesNested)for(const g of list)gameMap.set(g.id,g)
  const games=[...gameMap.values()].sort((a:any,b:any)=>String(a.game_date).localeCompare(String(b.game_date))||String(a.game_time||'').localeCompare(String(b.game_time||'')))
  const teamIds=new Set(activeTeams.map((t:any)=>t.id))
  const records=new Map<string,{w:number;l:number;t:number}>()
  for(const t of activeTeams)records.set(t.id,{w:0,l:0,t:0})
  for(const g of games){if(g.status!=='Final'||g.home_score==null||g.away_score==null)continue;const golf=String(g.sport?.sport_name||'').toLowerCase().includes('golf');for(const id of [g.home_team_id,g.away_team_id]){if(!id||!records.has(id))continue;const r=records.get(id)!;const mine=id===g.home_team_id?g.home_score:g.away_score;const opp=id===g.home_team_id?g.away_score:g.home_score;if(mine===opp)r.t++;else if(golf?mine<opp:mine>opp)r.w++;else r.l++}}
  const upcoming=games.filter((g:any)=>g.game_date>=today&&['Scheduled','Postponed'].includes(g.status)).slice(0,10)
  const recent=games.filter((g:any)=>g.status==='Final').sort((a:any,b:any)=>String(b.game_date).localeCompare(String(a.game_date))).slice(0,12)
  const initials=school.alias||String(school.school_name||'').split(' ').filter((w:string)=>!['Central','School','Free','Academy','High','of'].includes(w)).map((w:string)=>w[0]).join('').slice(0,3).toUpperCase()
  const side=(g:any)=>teamIds.has(g.home_team_id)?'home':teamIds.has(g.away_team_id)?'away':null
  const opponent=(g:any)=>side(g)==='home'?(g.away_team?.school?.school_name||g.external_away?.name||'TBD'):(g.home_team?.school?.school_name||g.external_home?.name||'TBD')
  return <PublicLayout><div className="max-w-6xl mx-auto px-4 py-6">
    <div className="rounded-2xl overflow-hidden mb-6" style={{background:`linear-gradient(135deg,${school.primary_color||'#1e2d47'},${school.secondary_color||'#0f172a'}cc)`}}><div className="px-6 py-8 flex items-end justify-between gap-4"><div><Link href="/schools" className="text-xs text-white/60">Schools /</Link><h1 className="text-4xl md:text-5xl font-black text-white mt-2" style={{fontFamily:'var(--font-display)'}}>{school.school_name}</h1><p className="text-white/70 font-bold mt-1">{school.mascot}</p>{activeSeason&&<span className="inline-block mt-3 rounded-full px-3 py-1 text-xs font-black bg-black/20 text-white/80">{activeSeason.name}</span>}</div><div className="w-24 h-24 rounded-2xl bg-black/20 border border-white/20 flex items-center justify-center overflow-hidden">{school.logo_url?<img src={school.logo_url} alt="" className="w-full h-full object-contain p-2"/>:<span className="font-black text-white text-2xl">{initials}</span>}</div></div></div>
    {schoolSponsor&&<a href={schoolSponsor.website_url||'#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6 border border-blue-500/20 bg-blue-500/5">{schoolSponsor.logo_url&&<img src={schoolSponsor.logo_url} alt="" className="w-9 h-9 object-contain"/>}<div><div className="text-[10px] uppercase tracking-wider text-slate-500">School coverage by</div><div className="font-black text-white">{schoolSponsor.business_name}</div></div></a>}
    <section className="mb-7"><div className="flex items-center gap-2 mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm">Teams</h2><div className="flex-1 h-px bg-white/10"/></div><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{activeTeams.map((t:any)=>{const r=records.get(t.id)||{w:0,l:0,t:0};const label=sportLabel(t);return <Link key={t.id} href={`/teams/${t.slug}`} className="rounded-xl p-4 bg-white/[.03] border border-white/[.08] hover:bg-white/[.05]"><div className="text-2xl">{SPORT_ICONS[label]||'🏆'}</div><div className="font-black text-white mt-2">{label||t.team_name}</div><div className="text-xs text-slate-500 mt-1">{[t.division&&`${t.division} Division`,t.class&&`Class ${t.class}`].filter(Boolean).join(' · ')}</div><div className="text-sm text-slate-300 mt-3">{r.w}-{r.l}{r.t?`-${r.t}`:''}</div></Link>})}</div></section>
    <section className="mb-7"><div className="flex items-center gap-2 mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm">Upcoming</h2><div className="flex-1 h-px bg-white/10"/></div>{upcoming.length?<div className="rounded-xl overflow-hidden border border-white/[.07]">{upcoming.map((g:any)=><Link key={g.id} href={`/game-center/${g.id}`} className="grid grid-cols-[75px_1fr_auto] gap-3 px-4 py-3 border-b border-white/[.05] last:border-0"><span className="text-xs text-slate-500 font-black">{formatDate(g.game_date)}</span><span className="font-bold text-white">{g.neutral_site?'vs':side(g)==='home'?'vs':'@'} {opponent(g)}</span><span className="text-xs text-slate-400">{formatTime(g.game_time)}</span></Link>)}</div>:<div className="rounded-xl p-5 text-sm text-slate-500 border border-white/[.06]">No upcoming games loaded.</div>}</section>
    {recent.length>0&&<section><div className="flex items-center gap-2 mb-3"><h2 className="font-black text-white uppercase tracking-widest text-sm">Recent Results</h2><div className="flex-1 h-px bg-white/10"/></div><div className="grid md:grid-cols-2 gap-3">{recent.map((g:any)=>{const s=side(g);const mine=s==='home'?g.home_score:g.away_score;const opp=s==='home'?g.away_score:g.home_score;return <Link key={g.id} href={`/game-center/${g.id}`} className="rounded-xl p-4 bg-white/[.03] border border-white/[.08]"><div className="text-xs text-slate-500">{formatDate(g.game_date)} · {sportLabel({sport:g.sport})}</div><div className="font-black text-white mt-1">{opponent(g)}</div><div className="text-xl font-black mt-2 text-white">{mine} - {opp}</div></Link>})}</div></section>}
  </div></PublicLayout>
}
