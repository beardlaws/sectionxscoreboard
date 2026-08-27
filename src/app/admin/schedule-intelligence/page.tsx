import AdminLayout from '@/components/layout/AdminLayout'
import { createClient } from '@/lib/supabase/server'
import ScheduleIntelligence from './ScheduleIntelligence'

export const revalidate = 0

export default async function ScheduleIntelligencePage() {
  const supabase = createClient()
  const { data: allSeasons, error } = await supabase
    .from('seasons')
    .select('id,name,year,season_type,is_active')
    .in('season_type', ['Fall', 'Winter', 'Spring'])
    .order('year', { ascending: false })

  if (error) throw new Error(`Could not load seasons: ${error.message}`)

  const rows=allSeasons||[]
  const active=rows.find((s:any)=>s.is_active)||rows[0]||null
  let seasons=rows
  if(active){
    const y=Number(active.year)
    const type=String(active.season_type)
    const schoolYearStart=type==='Spring'?y-1:y
    seasons=rows.filter((s:any)=>
      (s.season_type==='Fall'&&Number(s.year)===schoolYearStart)||
      (s.season_type==='Winter'&&Number(s.year)===schoolYearStart)||
      (s.season_type==='Spring'&&Number(s.year)===schoolYearStart+1)
    )
  }

  const rank:Record<string,number>={Fall:0,Winter:1,Spring:2}
  seasons=[...seasons].sort((a:any,b:any)=>(rank[a.season_type]??9)-(rank[b.season_type]??9))

  return (
    <AdminLayout>
      <ScheduleIntelligence seasons={seasons} />
    </AdminLayout>
  )
}
