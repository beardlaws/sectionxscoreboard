import AdminLayout from '@/components/layout/AdminLayout'
import { createAdminClient } from '@/lib/supabase/server'
import FanZoneAdminClient from './FanZoneAdminClient'

export const dynamic='force-dynamic'
export default async function FanZoneAdminPage(){
 const db=createAdminClient()
 const [{data:plays},{data:snapshots},{data:ballots}]=await Promise.all([
  db.from('fan_top_play_nominations').select('*,school:schools(school_name),sport:sports(sport_name,gender)').order('created_at',{ascending:false}).limit(100),
  db.from('fan_power_rank_snapshots').select('*,sport:sports(sport_name,gender)').order('week_start',{ascending:false}).limit(50),
  db.from('fan_power_rank_ballots').select('week_start,sport_id,group_type,group_value,rankings,updated_at,sport:sports(sport_name,gender)').order('updated_at',{ascending:false}).limit(500)
 ])
 return <AdminLayout><div className="p-4 max-w-6xl"><h1 className="text-2xl font-black text-white">Fan Zone Control Room</h1><p className="text-sm text-slate-500 mt-1 mb-5">Review Top 5 Play nominations and watch fan power-ranking ballots build.</p><FanZoneAdminClient plays={plays||[]} snapshots={snapshots||[]} ballots={ballots||[]}/></div></AdminLayout>
}
