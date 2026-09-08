import AdminLayout from '@/components/layout/AdminLayout'
import { createAdminClient } from '@/lib/supabase/server'
import CrossCountryAdminClient from './CrossCountryAdminClient'

export const dynamic='force-dynamic'

export default async function CrossCountryAdminPage(){
  const db=createAdminClient()
  const [{data:meets},{data:results}]=await Promise.all([
    db.from('cross_country_meets').select('*').order('meet_date',{ascending:false}),
    db.from('cross_country_team_results').select(`*,sport:sports(id,gender,slug),team:teams(id,team_name,school:schools(id,school_name,slug)),external_opponent:external_opponents(id,name,slug)`).order('finish_place',{ascending:true})
  ])
  const rows=(meets||[]).map((m:any)=>({...m,results:(results||[]).filter((r:any)=>r.meet_id===m.id)}))
  return <AdminLayout><div className="p-4 md:p-6 max-w-5xl mx-auto"><div className="mb-6"><div className="text-xs font-black uppercase tracking-[.2em] text-lime-300">Section X Cross Country</div><h1 className="text-3xl font-black text-white mt-1">Meet Manager</h1><p className="text-sm mt-1" style={{color:'var(--text-muted)'}}>Create meets and publish boys and girls team results without forcing XC into two-team game scoring.</p></div><CrossCountryAdminClient meets={rows}/></div></AdminLayout>
}
