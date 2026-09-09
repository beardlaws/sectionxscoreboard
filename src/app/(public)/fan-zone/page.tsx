import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'
import { createPublicClient as createClient } from '@/lib/supabase/public'
import FanZoneClient from './FanZoneClient'

export const metadata:Metadata={title:'Fan Zone',description:'Nominate Section X Top 5 plays and submit your weekly fan power rankings.'}
export const revalidate=300

export default async function FanZonePage(){
 const db=createClient()
 const now=new Date(),monday=new Date(now);monday.setUTCDate(now.getUTCDate()-((now.getUTCDay()+6)%7));const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);const week=monday.toISOString().slice(0,10)
 const [{data:season},{data:sports},{data:schools},{data:snapshots},{data:featured},{data:gameVotes},{data:schoolVotes}]=await Promise.all([
  db.from('seasons').select('id').eq('is_active',true).single(),
  db.from('sports').select('id,slug,sport_name,gender,season_type').eq('season_type','Fall').order('sport_name'),
  db.from('schools').select('id,school_name').eq('active',true).eq('is_section_x',true).order('school_name'),
  db.from('fan_power_rank_snapshots').select('ballot_count').eq('published',true).order('week_start',{ascending:false}).limit(30),
  db.from('fan_top_play_nominations').select('id,athlete_name,play_description,school:schools(school_name),sport:sports(sport_name,gender)').in('status',['approved','featured']).order('created_at',{ascending:false}).limit(100),
  db.from('fan_game_vote_snapshots').select('game_id,votes').eq('week_start',week).eq('published',true),
  db.from('fan_school_support_snapshots').select('school_id,votes').eq('week_start',week).eq('published',true)
 ])
 const sportIds=(sports||[]).map((s:any)=>s.id)
 const {data:teamSeasons}=season&&sportIds.length?await db.from('team_seasons').select('class,division,active_for_season,team:teams(id,sport_id,team_name,level,active,school:schools(school_name))').eq('season_id',season.id).neq('active_for_season',false):{data:[]}
 const teams=(teamSeasons||[]).map((x:any)=>{const t=Array.isArray(x.team)?x.team[0]:x.team;const sc=Array.isArray(t?.school)?t.school[0]:t?.school;return{id:t?.id,sport_id:t?.sport_id,name:t?.team_name,school:sc?.school_name||t?.team_name,className:x.class||'',division:x.division||''}}).filter((t:any)=>t.id&&sportIds.includes(t.sport_id))
 const ballotTotal=(snapshots||[]).reduce((sum:number,x:any)=>sum+Number(x.ballot_count||0),0)
 const {data:games}=await db.from('games').select('id,game_date,game_time,home_team:teams!games_home_team_id_fkey(team_name,school:schools(school_name)),away_team:teams!games_away_team_id_fkey(team_name,school:schools(school_name)),sport:sports(sport_name,gender)').gte('game_date',monday.toISOString().slice(0,10)).lte('game_date',sunday.toISOString().slice(0,10)).order('game_date').limit(80)
 const voteMap=new Map((gameVotes||[]).map((x:any)=>[x.game_id,Number(x.votes||0)])),schoolVoteMap=new Map((schoolVotes||[]).map((x:any)=>[x.school_id,Number(x.votes||0)]))
 const gameCandidates=(games||[]).map((g:any)=>({...g,votes:voteMap.get(g.id)||0})).slice(0,12)
 const schoolPulse=(schools||[]).map((s:any)=>({...s,votes:schoolVoteMap.get(s.id)||0})).sort((a:any,b:any)=>b.votes-a.votes||a.school_name.localeCompare(b.school_name))
 return <PublicLayout><main className="max-w-5xl mx-auto px-4 py-7">
  <section className="relative overflow-hidden rounded-[28px] border border-blue-400/15 bg-gradient-to-br from-blue-500/[.12] via-white/[.025] to-yellow-300/[.06] p-6 sm:p-8 mb-7">
    <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl"/>
    <div className="relative">
      <div className="text-[10px] font-black uppercase tracking-[.24em] text-blue-300/80">Section X Fan Zone</div>
      <h1 className="mt-2 text-4xl sm:text-5xl font-black text-white leading-[.95]">You don’t just watch Section X.<br/><span className="text-yellow-300">You shape the conversation.</span></h1>
      <p className="mt-4 max-w-2xl text-sm sm:text-base text-white/45">Nominate the plays everyone should see. Build your Top 5. Then come back and see whether the rest of Section X agrees with you.</p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse"/>Fan Zone is live this week</div>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="text-2xl font-black text-white">{ballotTotal}</div><div className="text-[10px] uppercase tracking-wider text-white/35">Fan ballots</div></div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="text-2xl font-black text-white">{(featured||[]).length}</div><div className="text-[10px] uppercase tracking-wider text-white/35">Play nominations</div></div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="text-2xl font-black text-yellow-300">5→1</div><div className="text-[10px] uppercase tracking-wider text-white/35">Ranking points</div></div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="text-2xl font-black text-blue-300">Weekly</div><div className="text-[10px] uppercase tracking-wider text-white/35">Fresh ballot</div></div>
      </div>
    </div>
  </section>
  <section className="mb-6 rounded-2xl border border-white/8 bg-white/[.025] px-5 py-4"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-300/70">The Section X Pulse</div><div className="mt-1 font-black text-white">This week belongs to the fans.</div></div><div className="text-xs text-white/40">Nominate the moments. Rank the teams. Come back to see where Section X lands.</div></div></section>
  <FanZoneClient sports={sports||[]} teams={teams} schools={schools||[]} featuredPlays={featured||[]} gameCandidates={gameCandidates} schoolPulse={schoolPulse}/>
 </main></PublicLayout>
}
