import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'
import FanZoneClient from './FanZoneClient'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'
import { getFanZoneRepository } from '@/lib/data/runtime-fan-zone-repository'

export const metadata:Metadata={title:'Fan Zone',description:'Nominate Section X Top 5 plays and submit your weekly fan power rankings.'}
export const dynamic='force-dynamic'

export default async function FanZonePage(){
 const sportsRepo=getSportsRepository(),fanRepo=getFanZoneRepository()
 const now=new Date(),monday=new Date(now);monday.setUTCDate(now.getUTCDate()-((now.getUTCDay()+6)%7));const week=monday.toISOString().slice(0,10)
 const [season,allSports,allSchools,ballotTotal,featured,schoolVotes]=await Promise.all([
  sportsRepo.getActiveSeason(),sportsRepo.getSports(),sportsRepo.getSchools(),fanRepo.getBallotTotal(30),fanRepo.getFeaturedPlays(100),fanRepo.getSchoolVotes(week)
 ])
 const sports=allSports.filter((s:any)=>s.active_public&&s.season_type==='Fall')
 const schools=allSchools.filter((s:any)=>s.active&&s.is_section_x!==false).map((s:any)=>({id:s.id,school_name:s.school_name}))
 const sportIds=sports.map((s:any)=>s.id)
 const teams=season?await fanRepo.getTeamsForSports(season.id,sportIds):[]
 const schoolVoteMap=new Map((schoolVotes||[]).map((x:any)=>[x.school_id,Number(x.votes||0)]))
 const schoolPulse=schools.map((s:any)=>({...s,votes:schoolVoteMap.get(s.id)||0})).sort((a:any,b:any)=>b.votes-a.votes||a.school_name.localeCompare(b.school_name))
 return <PublicLayout><main className="max-w-5xl mx-auto px-4 py-7">
  <section className="relative overflow-hidden rounded-[28px] border border-blue-400/15 bg-gradient-to-br from-blue-500/[.12] via-white/[.025] to-yellow-300/[.06] p-6 sm:p-8 mb-7">
    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl"/>
    <div className="relative"><div className="text-[10px] font-black uppercase tracking-[.24em] text-blue-300/80">Section X Fan Zone</div><h1 className="mt-2 text-4xl sm:text-5xl font-black text-white leading-[.95]">Make the plays. Rank the teams.<br/><span className="text-yellow-300">Rep your school.</span></h1><p className="mt-4 max-w-2xl text-sm sm:text-base text-white/45">This is where Section X arguments become official. Nominate a Top 5 moment, build your own power rankings, and show us which school has the loudest fanbase.</p><div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse"/>Fan Zone is live this week</div>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3"><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="text-2xl font-black text-white">{ballotTotal}</div><div className="text-[10px] uppercase tracking-wider text-white/35">Fan ballots</div></div><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="text-2xl font-black text-white">{featured.length}</div><div className="text-[10px] uppercase tracking-wider text-white/35">Play nominations</div></div><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="text-2xl font-black text-yellow-300">5→1</div><div className="text-[10px] uppercase tracking-wider text-white/35">Ranking points</div></div><div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="text-2xl font-black text-blue-300">Weekly</div><div className="text-[10px] uppercase tracking-wider text-white/35">Fresh ballot</div></div></div>
    </div>
  </section>
  <section className="mb-6 rounded-2xl border border-white/8 bg-white/[.025] px-5 py-4"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-300/70">The Section X Pulse</div><div className="mt-1 font-black text-white">This week belongs to the fans.</div></div><div className="text-xs text-white/40">Top 5 nominations feed the weekly recap. Fan ballots build the crowd rankings. School pride settles the rest.</div></div></section>
  <FanZoneClient sports={sports} teams={teams} schools={schools} featuredPlays={featured} schoolPulse={schoolPulse}/>
 </main></PublicLayout>
}
