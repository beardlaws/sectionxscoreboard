import AdminLayout from '@/components/layout/AdminLayout'
import { createClient } from '@/lib/supabase/server'
import ScheduleIntelligence from './ScheduleIntelligence'

export const revalidate = 0

export default async function ScheduleIntelligencePage() {
  const supabase = createClient()
  const { data: seasons, error } = await supabase
    .from('seasons')
    .select('id,name,year,season_type,is_active')
    .in('season_type', ['Fall', 'Winter', 'Spring'])
    .order('year', { ascending: false })

  if (error) throw new Error(`Could not load seasons: ${error.message}`)

  return (
    <AdminLayout>
      <ScheduleIntelligence seasons={seasons || []} />
    </AdminLayout>
  )
}
