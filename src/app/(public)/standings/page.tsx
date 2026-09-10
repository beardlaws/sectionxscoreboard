// src/app/(public)/standings/page.tsx
import { unstable_noStore as noStore } from 'next/cache'
import { Metadata } from 'next'
import Link from 'next/link'
import { calculateStandings } from '@/lib/standings'
import { calculateCrossCountryStandings } from '@/lib/cross-country'
import { GameWithTeams } from '@/types'
import { Trophy } from 'lucide-react'
import PublicLayout from '@/components/layout/PublicLayout'
import StandingsToggle from '@/components/StandingsToggle'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import { getCrossCountryRepository } from '@/lib/data/runtime-cross-country-repository'

export const metadata: Metadata = {
  title: 'Standings | Section X Scoreboard',
  description: 'Section X high school sports standings with league record, overall record, and Bradley-Terry Model rankings.',
}
export const dynamic = 'force-dynamic'

interface Props { searchParams: Promise<{ sport?: string; season?: string }> }
const DIVISION_ORDER = ['East', 'Central', 'West', 'North', 'South']
const SEASON_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Spring: { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', border: 'rgba(34,197,94,0.25)' },
  Fall: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  Winter: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
}
function sportLabel(sport:any){const name=String(sport?.sport_name||'').trim();const gender=String(sport?.gender||'').trim();return (gender==='Boys'||gender==='Girls')&&!name.toLowerCase().startsWith(gender.toLowerCase()+' ')?`${gender} ${name}`:name}

export default async function StandingsPage({searchParams}:Props){
  noStore()
  const params=await searchParams
  const repo=getSportsRepository()
  const xcRepo=getCrossCountryRepository()
  const [allSeasons,allSports]=await Promise.all([repo.getSeasons(),repo.getSports()])
  const activeSeason=allSeasons.find((s:any)=>s.is_active)
  const selectedSeasonId=params.season||activeSeason?.id
  const selectedSeason=allSeasons.find((s:any)=>s.id===selectedSeasonId)||activeSeason

  const teamSeasonGroups=selectedSeasonId?await Promise.all(allSports.map(async(sport:any)=>[sport.id,await repo.getTeamSeasonsForSport(sport.id,selectedSeasonId)] as const)):[]
  const teamSeasonsBySport=new Map<string,any[]>(teamSeasonGroups as any)
  const uniqueSports=allSports.filter((sport:any)=>{
    if((teamSeasonsBySport.get(sport.id)||[]).length>0)return true
    if(selectedSeason?.season_type==='Fall'&&['boys-cross-country','girls-cross-country'].includes(sport.slug))return true
    return false
  }).sort((a:any,b:any)=>sportLabel(a).localeCompare(sportLabel(b)))

  const preferredDefault=uniqueSports.find((s:any)=>s.slug==='boys-soccer')||uniqueSports.find((s:any)=>s.slug==='girls-soccer')||uniqueSports[0]
  const selectedSlug=params.sport||preferredDefault?.slug
  const selectedSport=allSports.find((s:any)=>s.slug===selectedSlug)||uniqueSports[0]
  let standings:any[]=[]
  let sportTeamSeasons:any[]=[]

  if(selectedSport&&selectedSeasonId){
    sportTeamSeasons=(teamSeasonsBySport.get(selectedSport.id)||[]).filter((record:any)=>{
      const team=record.team
      if(!team)return false
      if(team.active===false)return false
      if(team.level&&team.level.toLowerCase().trim()!=='varsity')return false
      return true
    })
    if(selectedSport.slug==='volleyball'){
      const volleyballDivisions:Record<string,'East'|'West'>={
        'Brushton-Moira':'East','Chateaugay':'East','Malone':'East','Massena':'East','Salmon River':'East','Tupper Lake':'East',
        'Canton':'West','Clifton-Fine':'West','Gouverneur':'West','Madrid-Waddington':'West','Ogdensburg Free Academy':'West','Potsdam':'West',
      }
      sportTeamSeasons=sportTeamSeasons.map((record:any)=>{
        const officialDivision=volleyballDivisions[String(record.team?.school?.school_name||'').trim()]
        return officialDivision?{...record,division:officialDivision}:record
      })
    }
    if(['boys-cross-country','girls-cross-country'].includes(selectedSport.slug)){
      const xcMeets=await xcRepo.getMeetsForSeason(selectedSeasonId)
      const meetIds=xcMeets.map((m:any)=>String(m.id))
      const [xcResults,xcDuals]=await Promise.all([
        xcRepo.getTeamResultsForSport(selectedSport.id,meetIds),
        xcRepo.getDualResultsForSport(selectedSport.id,meetIds),
      ])
      standings=calculateCrossCountryStandings(xcMeets,xcResults,sportTeamSeasons,selectedSport.id,xcDuals)
    }else{
      const gamesData=await repo.getFinalGamesForSport(selectedSport.id,selectedSeasonId)
      standings=calculateStandings((gamesData as GameWithTeams[])||[],sportTeamSeasons,selectedSport.sport_name)
    }
  }

  interface Group{label:string;subLabel?:string;rows:any[]}
  const divisionGroups:Group[]=[];const classGroups:Group[]=[]
  const hasDivision=standings.some(r=>r.division);const hasClass=standings.some(r=>r.class)
  if(hasDivision){const divs=[...new Set(standings.map(r=>r.division||''))].filter(Boolean) as string[];const sorted=[...DIVISION_ORDER.filter(d=>divs.includes(d)),...divs.filter(d=>!DIVISION_ORDER.includes(d))];for(const div of sorted){const rows=standings.filter(r=>r.division===div);if(rows.length)divisionGroups.push({label:`${div} Division`,rows})}const none=standings.filter(r=>!r.division);if(none.length)divisionGroups.push({label:'Non-League',rows:none})}else divisionGroups.push({label:'',rows:standings})
  const CLASS_ORDER_SORT=['A','B','C','D']
  if(hasClass){const classes=([...new Set(standings.map(r=>r.class||''))].filter(Boolean) as string[]).sort((a,b)=>CLASS_ORDER_SORT.indexOf(a)-CLASS_ORDER_SORT.indexOf(b));for(const cls of classes){const rows=standings.filter(r=>r.class===cls).sort((a,b)=>{const ranked=b.btm-a.btm||b.wins-a.wins||a.losses-b.losses;if(ranked!==0)return ranked;return(a.school_name||a.team_name).localeCompare(b.school_name||b.team_name)});if(rows.length)classGroups.push({label:`Class ${cls}`,rows})}const none=standings.filter(r=>!r.class);if(none.length)classGroups.push({label:'Unclassified',rows:none})}else classGroups.push({label:'',rows:standings})

  const icons:Record<string,string>={Baseball:'⚾',Softball:'🥎','Boys Lacrosse':'🥍','Girls Lacrosse':'🥍',Football:'🏈','Boys Basketball':'🏀','Girls Basketball':'🏀','Boys Hockey':'🏒','Girls Hockey':'🏒','Boys Soccer':'⚽','Girls Soccer':'⚽',Volleyball:'🏐','Boys Golf':'⛳','Boys Wrestling':'🤼','Girls Wrestling':'🤼','Boys Track':'🏃','Girls Track':'🏃',Swimming:'🏊','Girls Swimming':'🏊','Boys Cross Country':'🏃','Girls Cross Country':'🏃'}
  const isPreseason=standings.length>0&&standings.every(row=>row.wins===0&&row.losses===0&&row.ties===0)
  const isCrossCountry=['boys-cross-country','girls-cross-country'].includes(selectedSport?.slug)

  return <PublicLayout><div className="max-w-5xl mx-auto px-4 py-6">
    <div className="flex items-center gap-3 mb-4"><Trophy size={28} className="text-yellow-400 flex-shrink-0"/><div><h1 className="text-3xl font-bold font-display text-white">Standings</h1>{selectedSeason&&<p className="text-slate-400 text-sm mt-0.5">{selectedSeason.name} · BTM = Bradley-Terry Model</p>}</div></div>
    {allSeasons.length>1&&<div className="flex items-center gap-2 flex-wrap mb-4"><span className="text-xs text-slate-500">SEASON:</span>{allSeasons.map((s:any)=>{const selected=s.id===selectedSeasonId;const c=SEASON_COLORS[s.season_type||'Spring']||SEASON_COLORS.Spring;return <a key={s.id} href={s.is_active?'/standings':`/standings?season=${s.id}`} className="text-xs font-black px-3 py-1 rounded-full" style={{background:selected?c.bg:'rgba(255,255,255,0.04)',color:selected?c.text:'#4a5f7a',border:`1px solid ${selected?c.border:'rgba(255,255,255,0.06)'}`}}>{s.name}{s.is_active?' ✓':''}</a>})}</div>}
    {uniqueSports.length>0&&<div className="flex flex-wrap gap-2 mb-5">{uniqueSports.map((s:any)=>{const fullName=sportLabel(s);const seasonParam=params.season?`&season=${params.season}`:'';return <Link key={s.slug} href={`/standings?sport=${s.slug}${seasonParam}`} className={`px-3 py-1.5 rounded-full text-sm font-medium ${s.slug===selectedSlug?'bg-ice text-navy':'bg-white/10 text-slate-300 hover:bg-white/20'}`}>{icons[fullName]||icons[s.sport_name]||'🏆'} {fullName}</Link>})}</div>}
    {standings.length===0?<div className="card p-10 text-center text-slate-400"><p className="text-3xl mb-3">🏆</p><p className="font-medium text-lg">No active teams found{selectedSport?` for ${sportLabel(selectedSport)}`:''}.</p></div>:isCrossCountry?<><div className="mb-4 rounded-xl px-4 py-3 border border-lime-500/20 bg-lime-500/5"><p className="text-sm font-bold text-lime-300">{sportLabel(selectedSport)} league standings</p><p className="text-xs text-slate-400 mt-0.5">League meets only. Lower team score wins each head-to-head matchup. Invitational results do not affect W-L.</p></div><div className="card overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-xs text-slate-400 border-b border-white/10"><th className="px-4 py-3 text-left">Team</th><th className="px-3 py-3 text-center">W</th><th className="px-3 py-3 text-center">L</th><th className="px-3 py-3 text-center">T</th></tr></thead><tbody>{standings.map((row:any)=><tr key={row.team_id} className="border-b border-white/5"><td className="px-4 py-3"><Link href={`/teams/${row.slug}`} className="text-white hover:text-ice">{row.school_name||row.team_name}</Link></td><td className="text-center">{row.wins}</td><td className="text-center">{row.losses}</td><td className="text-center">{row.ties}</td></tr>)}</tbody></table></div></div></>:<StandingsToggle divisionGroups={divisionGroups} classGroups={classGroups} isPreseason={isPreseason}/>} 
  </div></PublicLayout>
}
