import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { getPublicContentRepository } from '@/lib/data/runtime-public-content-repository'

export const dynamic = 'force-dynamic'
type PageProps={params:Promise<{slug:string}>}

function sportName(s:any){if(!s)return'Sport';const n=String(s.sport_name||''),g=String(s.gender||'');return(g==='Boys'||g==='Girls')&&!n.toLowerCase().startsWith(g.toLowerCase())?`${g} ${n}`:n}

export async function generateMetadata({params}:PageProps):Promise<Metadata>{
 const {slug}=await params
 const athlete=await getPublicContentRepository().getAthleteBySlug(slug)
 if(!athlete)return{title:'Athlete Not Found | Section X Scoreboard'}
 return{title:`${athlete.display_name} | ${athlete.school?.school_name||'Section X'} Athlete`,description:`${athlete.display_name} teams, recorded stats, roster history and approved photos on Section X Scoreboard.`}
}

export default async function AthletePage({params}:PageProps){
 const {slug}=await params
 const repo=getPublicContentRepository()
 const athlete=await repo.getAthleteBySlug(slug)
 if(!athlete)notFound()
 const [memberships,photos,recorded]=await Promise.all([
  repo.getAthleteMemberships(athlete.id),
  repo.getAthletePhotos(athlete.id),
  repo.getAthleteStats(athlete.id),
 ])
 const current=memberships.filter((r:any)=>r.active&&r.season?.is_active)
 const history=memberships.filter((r:any)=>!r.season?.is_active||!r.active)
 const school=athlete.school
 const groups=new Map<string,{sport:any;season:any;stats:Map<string,{def:any,total:number}>;games:Set<string>}>()
 for(const row of recorded){if(!row.game||!row.stat_definition||row.game.status!=='Final')continue;const key=`${row.game.season_id||'season'}:${row.game.sport_id||'sport'}`;if(!groups.has(key))groups.set(key,{sport:row.game.sport,season:row.game.season,stats:new Map(),games:new Set()});const g=groups.get(key)!;g.games.add(row.game.id);if(row.value_numeric!==null&&row.value_numeric!==undefined){const sk=row.stat_definition.id;const ex=g.stats.get(sk)||{def:row.stat_definition,total:0};ex.total+=Number(row.value_numeric)||0;g.stats.set(sk,ex)}}
 const summaries=[...groups.values()].map(g=>({...g,stats:[...g.stats.values()].sort((a,b)=>(a.def.sort_order||0)-(b.def.sort_order||0))})).filter(g=>g.stats.length)
 const primary=school?.primary_color||'#1e3a5f',secondary=school?.secondary_color||'#0f172a'
 return <PublicLayout><div className="max-w-4xl mx-auto px-4 py-6">
  <div className="rounded-2xl p-6 md:p-8 mb-6" style={{background:`linear-gradient(135deg,${primary},${secondary}cc)`,border:'1px solid rgba(255,255,255,.10)'}}><div className="flex items-center justify-between gap-5"><div>{school&&<Link href={`/schools/${school.slug}`} className="text-xs text-white/60 hover:text-white">{school.school_name}</Link>}<h1 className="text-4xl md:text-5xl font-black text-white mt-2 leading-none" style={{fontFamily:'var(--font-display)'}}>{athlete.display_name}</h1>{school&&<p className="text-white/70 font-bold mt-2">{school.mascot}</p>}<div className="flex gap-2 mt-4 flex-wrap"><span className="text-xs rounded-full px-3 py-1 bg-black/20 text-white/70">{current.length} current team{current.length===1?'':'s'}</span><span className="text-xs rounded-full px-3 py-1 bg-black/20 text-white/70">{photos.length} approved photo{photos.length===1?'':'s'}</span></div></div>{school?.logo_url&&<div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-black/20 border border-white/10"><img src={school.logo_url} alt="" className="w-full h-full object-contain p-2"/></div>}</div></div>
  <section className="mb-7"><div className="flex items-center gap-2 mb-3"><h2 className="text-sm font-black uppercase tracking-widest text-blue-400">Current Teams</h2><div className="flex-1 h-px bg-white/[.06]"/></div>{current.length?<div className="grid md:grid-cols-2 gap-3">{current.map((r:any)=><Link key={r.id} href={`/teams/${r.team.slug}`} className="rounded-xl p-4 bg-white/[.03] border border-white/[.08]"><div className="text-xs text-slate-500 uppercase tracking-wider">{r.season.name}</div><div className="text-lg font-black text-white mt-1">{sportName(r.sport)}</div><div className="flex gap-2 flex-wrap mt-3">{r.jersey_number&&<span className="text-xs rounded-full px-2 py-1 bg-blue-500/10 text-blue-300">#{r.jersey_number}</span>}{[r.class_year,r.position,r.height].filter(Boolean).map((x:string)=><span key={x} className="text-xs rounded-full px-2 py-1 bg-white/5 text-slate-400">{x}</span>)}</div></Link>)}</div>:<div className="rounded-xl p-6 text-sm text-slate-500 bg-black/20 border border-white/[.06]">No verified current team membership is published yet.</div>}</section>
  {summaries.length>0&&<section className="mb-7"><div className="flex items-center gap-2 mb-3"><h2 className="text-sm font-black uppercase tracking-widest text-blue-400">Recorded Stats</h2><div className="flex-1 h-px bg-white/[.06]"/></div><div className="space-y-3">{summaries.map((g:any,i:number)=><div key={i} className="rounded-xl p-4 bg-white/[.03] border border-white/[.08]"><div className="font-black text-white">{sportName(g.sport)}</div><div className="text-xs text-slate-500 mb-3">{g.season?.name||'Season'} · {g.games.size} game{g.games.size===1?'':'s'} with recorded stats</div><div className="grid grid-cols-3 sm:grid-cols-5 gap-2">{g.stats.map((s:any)=><div key={s.def.id} className="rounded-lg p-3 text-center bg-black/20"><div className="text-xl font-black text-white">{s.total.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider text-slate-500">{s.def.label||s.def.stat_key}</div></div>)}</div></div>)}</div><p className="text-[11px] text-slate-600 mt-2">Totals include only stats recorded by Section X Scoreboard and may not represent every game played.</p></section>}
  <section className="mb-7"><div className="flex items-center gap-2 mb-3"><h2 className="text-sm font-black uppercase tracking-widest text-blue-400">Photo Gallery</h2><div className="flex-1 h-px bg-white/[.06]"/><span className="text-xs text-slate-500">{photos.length}</span></div>{photos.length?<div className="grid grid-cols-2 md:grid-cols-3 gap-3">{photos.map((p:any)=>{const card=<div className="rounded-xl overflow-hidden border border-white/10 bg-white/[.02] h-full"><div className="aspect-[4/3] overflow-hidden bg-black/30"><img src={p.photo_url} alt={p.caption||`${athlete.display_name} photo`} className="w-full h-full object-cover"/></div><div className="p-3">{p.caption&&<div className="text-xs text-slate-300 line-clamp-2">{p.caption}</div>}<div className="text-[10px] text-slate-500 mt-1">Photo: {p.photographer_credit_name||'Section X contributor'}</div></div></div>;return p.game_id?<Link key={p.id} href={`/game-center/${p.game_id}`}>{card}</Link>:<div key={p.id}>{card}</div>})}</div>:<div className="rounded-xl p-6 text-sm text-slate-500 bg-black/20 border border-white/[.06]">No approved photos are tagged to this athlete yet.</div>}</section>
  {history.length>0&&<section><div className="flex items-center gap-2 mb-3"><h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Team History</h2><div className="flex-1 h-px bg-white/[.06]"/></div><div className="rounded-xl overflow-hidden bg-black/20 border border-white/[.06]">{history.map((r:any)=><Link key={r.id} href={`/teams/${r.team.slug}`} className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/[.05] last:border-0"><div><div className="font-bold text-white">{sportName(r.sport)}</div><div className="text-xs text-slate-500">{r.season.name}</div></div><div className="text-xs text-slate-500">{r.class_year||''}</div></Link>)}</div></section>}
 </div></PublicLayout>
}
