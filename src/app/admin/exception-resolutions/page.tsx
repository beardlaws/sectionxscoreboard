import AdminLayout from '@/components/layout/AdminLayout'
import { createClient } from '@/lib/supabase/server'
import ResolutionClient from './ResolutionClient'

export const revalidate = 0

export default async function ExceptionResolutionsPage(){
  const db=createClient()
  const {data:seasons}=await db.from('seasons').select('id,name,is_active,year').order('year',{ascending:false})
  const active=(seasons||[]).find((s:any)=>s.is_active)||(seasons||[])[0]||null
  return <AdminLayout><div className="p-4 max-w-6xl"><ResolutionClient season={active}/></div></AdminLayout>
}
