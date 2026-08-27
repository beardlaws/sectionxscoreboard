import AdminLayout from '@/components/layout/AdminLayout'
import { createClient } from '@/lib/supabase/server'
import FallOperations from './FallOperations'

export const revalidate=0

export default async function FallOperationsPage(){
  const supabase=createClient()
  const {data:seasons,error}=await supabase.from('seasons').select('id,name,season_type,year,is_active').in('season_type',['Fall','Winter','Spring']).order('year',{ascending:false})
  if(error)throw new Error(error.message)
  const active=(seasons||[]).find((s:any)=>s.is_active)||(seasons||[])[0]||null
  return <AdminLayout><FallOperations season={active}/></AdminLayout>
}
