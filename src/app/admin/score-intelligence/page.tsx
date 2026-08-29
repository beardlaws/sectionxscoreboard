import AdminLayout from '@/components/layout/AdminLayout'
import { createClient } from '@/lib/supabase/server'
import ScoreIntelligence from './ScoreIntelligence'

export const revalidate = 0

export default async function ScoreIntelligencePage() {
  const supabase = createClient()
  const { data: sports } = await supabase
    .from('sports')
    .select('id,sport_name,gender,slug')
    .order('sport_name')

  return (
    <AdminLayout>
      <ScoreIntelligence sports={sports || []} />
    </AdminLayout>
  )
}
