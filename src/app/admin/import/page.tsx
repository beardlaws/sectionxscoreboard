// src/app/admin/import/page.tsx
import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import ImportCenter from './ImportCenter'

export const revalidate = 0

export default async function ImportPage() {
  const supabase = createClient()

  const [
    { data: teams },
    { data: sports },
    { data: seasons },
  ] = await Promise.all([
    supabase.from('teams').select('*, school:schools(school_name, alias, primary_color, slug)').eq('active', true),
    supabase.from('sports').select('*').order('sport_name'),
    supabase.from('seasons').select('*').order('year', { ascending: false }),
  ])

  return (
    <AdminLayout>
      <ImportCenter teams={teams || []} sports={sports || []} seasons={seasons || []} />
    </AdminLayout>
  )
}
