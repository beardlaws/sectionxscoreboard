import AdminLayout from '@/components/layout/AdminLayout'
import { createClient,createAdminClient } from '@/lib/supabase/server'
import FallOperations from './FallOperations'
import AutomationPanel from './AutomationPanel'

export const revalidate=0

export default async function FallOperationsPage(){
  const supabase=createClient()
  const admin=createAdminClient()
  const [{data:seasons,error},{data:runs},{data:cronRows}]=await Promise.all([
    supabase.from('seasons').select('id,name,season_type,year,is_active').in('season_type',['Fall','Winter','Spring']).order('year',{ascending:false}),
    admin.from('arbiter_automation_runs').select('id,season_id,trigger_source,status,summary,started_at,finished_at').order('started_at',{ascending:false}).limit(12),
    admin.rpc('sectionx_arbiter_cron_status'),
  ])
  if(error)throw new Error(error.message)
  const active=(seasons||[]).find((s:any)=>s.is_active)||(seasons||[])[0]||null
  const activeRuns=(runs||[]).filter((r:any)=>!active?.id||!r.season_id||r.season_id===active.id)
  const cron=Array.isArray(cronRows)?cronRows[0]||null:cronRows||null
  return <AdminLayout><div className="space-y-5"><FallOperations season={active}/><div className="p-4 pt-0 max-w-6xl"><AutomationPanel runs={activeRuns} cron={cron}/></div></div></AdminLayout>
}
