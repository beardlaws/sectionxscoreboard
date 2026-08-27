import AdminLayout from '@/components/layout/AdminLayout'
import { createClient } from '@/lib/supabase/server'
import SeasonPreflight from './SeasonPreflight'

export const revalidate=0

export default async function SeasonPreflightPage(){
  const supabase=createClient()
  const {data,error}=await supabase.from('seasons').select('id,name,year,season_type,is_active').in('season_type',['Fall','Winter','Spring']).gte('year',2026).order('year',{ascending:true})
  if(error)throw new Error(`Could not load seasons: ${error.message}`)
  const seasons=(data||[]).filter((s:any)=>s.name==='Fall 2026'||s.name==='Winter 2026-27'||s.name==='Spring 2027')
  return <AdminLayout><SeasonPreflight seasons={seasons}/></AdminLayout>
}
