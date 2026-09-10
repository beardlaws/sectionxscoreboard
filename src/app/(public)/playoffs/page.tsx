import { Metadata } from 'next'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import { getPlayoffRepository } from '@/lib/data/runtime-playoff-repository'
import { getPublicContentRepository } from '@/lib/data/runtime-public-content-repository'
import { sectionXDate } from '@/lib/sectionx-time'

export const metadata: Metadata = { title:'Section X Playoffs | Brackets & Results', description:'Section X high school sports playoff brackets. Northern New York.' }
export const dynamic='force-dynamic'

const ICONS:Record<string,string>={'Girls Softball':'🥎','Boys Baseball':'⚾','Boys Lacrosse':'🥍','Girls Lacrosse':'🥍','Boys Basketball':'🏀','Girls Basketball':'🏀','Boys Hockey':'🏒','Girls Hockey':'🏒',Football:'🏈','Boys Soccer':'⚽','Girls Soccer':'⚽',Volleyball:'🏐','Boys Wrestling':'🤼'}
function cleanName(name:string){return name.replace('Boys Boys ','Boys ').replace('Girls Girls ','Girls ')}
function displayName(name:string,gender:string){if(!name||!gender)return name||'';if(name.startsWith(gender+' '))return name;if(gender==='Boys'&&name==='Baseball')return'Boys Baseball';if(gender==='Girls'&&name==='Softball')return'Girls Softball';return`${gender} ${name}`}

export default async function PlayoffsPage({searchParams}:{searchParams:Promise<{season?:string}>}){
 const params=await searchParams
 const sportsRepo=getSportsRepository(), playoffRepo=getPlayoffRepository(), contentRepo=getPublicContentRepository()
 const allSeasons=await sportsRepo.getSeasons(), activeSeason=allSeasons.find((s:any)=>s.is_active), selectedSeasonId=params.season||activeSeason?.id, selectedSeason=allSeasons.find((s:any)=>s.id===selectedSeasonId)||activeSeason
 const [tournaments,games,playoffSponsor]=await Promise.all([selectedSeasonId?playoffRepo.getTournamentsForSeason(selectedSeasonId):Promise.resolve([]),playoffRepo.getAllGames(),contentRepo.getPlayoffSponsor(sectionXDate())])
 const bySport:Record<string,any[]>={}
 for(const t of tournaments){const key=displayName(t.sport?.sport_name||'',t.sport?.gender||'');if(!bySport[key])bySport[key]=[];const tg=games.filter((g:any)=>g.tournament_id===t.id);bySport[key].push({...t,name:cleanName(t.name||''),gameCount:tg.length,finalCount:tg.filter((g:any)=>String(g.status).toLowerCase()==='final').length})}
 const colors:Record<string,any>={Spring:{bg:'rgba(34,197,94,0.12)',text:'#4ade80',border:'rgba(34,197,94,0.25)'},Fall:{bg:'rgba(245,158,11,0.12)',text:'#fbbf24',border:'rgba(245,158,11,0.25)'},Winter:{bg:'rgba(59,130,246,0.12)',text:'#60a5fa',border:'rgba(59,130,246,0.25)'}}
 return <PublicLayout><div className="max-w-5xl mx-auto px-4 py-6">
  <div className="flex items-center gap-3 mb-4"><span className="text-3xl">🏆</span><div><h1 className="text-3xl font-black text-white" style={{fontFamily:'var(--font-display)',letterSpacing:'0.04em'}}>Section X Playoffs</h1><p className="text-slate-400 text-sm">Single elimination · Seeded by BTM · {selectedSeason?.name}</p></div></div>
  {allSeasons.length>1&&<div className="flex items-center gap-2 flex-wrap mb-4"><span className="text-xs text-slate-500">SEASON:</span>{allSeasons.map((s:any)=>{const selected=params.season?s.id===params.season:Boolean(s.is_active),c=colors[s.season_type]||colors.Spring;return <a key={s.id} href={s.is_active?'/playoffs':`/playoffs?season=${s.id}`} className="text-xs font-black px-3 py-1 rounded-full" style={{background:selected?c.bg:'rgba(255,255,255,0.04)',color:selected?c.text:'#4a5f7a',border:`1px solid ${selected?c.border:'rgba(255,255,255,0.06)'}`}}>{s.name}{s.is_active?' ✓':''}</a>})}</div>}
  {playoffSponsor&&<a href={playoffSponsor.website_url||'#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5" style={{background:'linear-gradient(135deg, rgba(234,179,8,0.1), rgba(8,12,20,0.8))',border:'1px solid rgba(234,179,8,0.2)'}}>{playoffSponsor.logo_url&&<img src={playoffSponsor.logo_url} alt={playoffSponsor.business_name} className="w-8 h-8 object-contain rounded"/>}<div className="flex-1"><p className="text-xs text-yellow-600">PLAYOFFS PRESENTED BY</p><p className="font-black text-white text-sm">{playoffSponsor.business_name}</p>{playoffSponsor.tagline&&<p className="text-xs text-slate-400">{playoffSponsor.tagline}</p>}</div><span className="text-xs font-bold text-yellow-400">Visit →</span></a>}
  {Object.keys(bySport).length===0&&<div className="rounded-2xl p-16 text-center border border-white/6" style={{background:'rgba(8,12,20,0.7)'}}><p className="text-5xl mb-4">🏆</p><p className="text-white font-black text-xl">No Brackets Yet for {selectedSeason?.name}</p><p className="text-slate-500 text-sm mt-2">Playoff brackets will appear once seedings are announced.</p></div>}
  {Object.entries(bySport).map(([sport,ts])=><div key={sport} className="mb-8"><div className="flex items-center gap-2 mb-3"><span className="text-xl">{ICONS[sport]||'🏆'}</span><h2 className="text-xl font-black text-white uppercase tracking-widest">{sport}</h2><div className="flex-1 h-px bg-white/8 ml-2"/></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{ts.sort((a:any,b:any)=>String(a.class).localeCompare(String(b.class))).map((t:any)=><Link key={t.id} href={`/playoffs/${t.id}`} className="rounded-xl p-4 border transition-all hover:-translate-y-0.5" style={{background:'rgba(8,12,20,0.8)',border:t.status==='active'?'1px solid rgba(239,68,68,0.3)':t.status==='complete'?'1px solid rgba(34,197,94,0.2)':'1px solid rgba(255,255,255,0.08)'}}><div className="flex items-start justify-between mb-2"><span className="text-xs font-black text-blue-400 uppercase">Class {t.class}</span><span className="text-xs font-black uppercase">{t.status}</span></div><p className="text-white font-bold text-sm mb-2">{t.name}</p><p className="text-xs text-slate-600">{t.finalCount} of {t.gameCount} games complete</p><p className="text-xs font-bold text-blue-400 mt-2">View Bracket →</p></Link>)}</div></div>)}
 </div></PublicLayout>
}
