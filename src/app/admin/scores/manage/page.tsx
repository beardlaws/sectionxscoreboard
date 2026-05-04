import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import GamesManager from './GamesManager'

export const revalidate = 0

export default async function ManageGamesPage() {
  const supabase = createClient()
  const [{ data: sports }, { data: seasons }, { data: teams }] = await Promise.all([
    supabase.from('sports').select('id, sport_name, gender, slug').order('sport_name'),
    supabase.from('seasons').select('*').order('year', { ascending: false }),
    supabase.from('teams').select('id, team_name, sport_id, school:schools(school_name)').order('team_name'),
  ])
  return (
    <AdminLayout>
      <GamesManager sports={sports || []} seasons={seasons || []} teams={teams || []} />
    </AdminLayout>
  )
}
