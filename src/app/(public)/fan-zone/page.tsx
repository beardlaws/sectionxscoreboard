import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'
import { createPublicClient as createClient } from '@/lib/supabase/public'
import FanZoneClient from './FanZoneClient'

export const metadata:Metadata={title:'Fan Zone',description:'Nominate Section X Top 5 plays and submit your weekly fan power rankings.'}
export const revalidate=300

export default async function FanZonePage(){
 const db=createClient()
 const [{data:season},{data:sports},{data:schools}]=await Promise.all([
  db.from('seasons').select('id').eq('is_active',true).single(),
  db.from('sports').select('id,slug,sport_name,gender,season_type').eq('season_type','Fall').order('sport_name'),
  db.from('schools').select('id,school_name').eq('active',true).eq('is_section_x',true).order('school_name')
 ])
 const sportIds=(sports||[]).map((s:any)=>s.id)
 const {data:teamSeasons}=season&&sportIds.length?await db.from('team_seasons').select('class,division,active_for_season,team:teams(id,sport_id,team_name,level,active,school:schools(school_name))').eq('season_id',season.id).neq('active_for_season',false):{data:[]}
 const teams=(teamSeasons||[]).map((x:any)=>{const t=Array.isArray(x.team)?x.team[0]:x.team;const sc=Array.isArray(t?.school)?t.school[0]:t?.school;return{id:t?.id,sport_id:t?.sport_id,name:t?.team_name,school:sc?.school_name||t?.team_name,className:x.class||'',division:x.division||''}}).filter((t:any)=>t.id&&sportIds.includes(t.sport_id))
 return <PublicLayout><main className="max-w-5xl mx-auto px-4 py-7"><div className="mb-7"><div className="text-[10px] font-black uppercase tracking-[.22em] text-blue-300/75">Section X Fan Zone</div><h1 className="text-3xl sm:text-4xl font-black text-white mt-1">Your Takes. Your Plays. Your Rankings.</h1><p className="text-sm text-white/40 mt-2 max-w-2xl">Help build the weekly Top 5 Plays and tell the rest of Section X who belongs at the top.</p></div><FanZoneClient sports={sports||[]} teams={teams} schools={schools||[]}/></main></PublicLayout>
}
