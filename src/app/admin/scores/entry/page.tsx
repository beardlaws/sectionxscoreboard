// src/app/admin/scores/entry/page.tsx
import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import ScoreEntryForm from './ScoreEntryForm'

export const revalidate = 0

export default async function ScoreEntryPage() {
  const supabase = createClient()

  const [
    { data: sports },
    { data: teams },
    { data: seasons },
  ] = await Promise.all([
    supabase.from('sports').select('*').eq('active_public', true).order('sport_name'),
    supabase.from('teams').select('*, school:schools(*)').eq('active', true).order('team_name'),
    supabase.from('seasons').select('*').order('year', { ascending: false }),
  ])

  return (
    <AdminLayout>
      <div className="p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>Enter Score</h1>
        <ScoreEntryForm sports={sports || []} teams={teams || []} seasons={seasons || []} />
      </div>
    </AdminLayout>
  )
}
