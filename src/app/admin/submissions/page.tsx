// src/app/admin/submissions/page.tsx
import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import SubmissionQueue from './SubmissionQueue'

export const revalidate = 0

export default async function SubmissionsPage() {
  const supabase = createClient()

  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const { data: sports } = await supabase.from('sports').select('*').order('sport_name')
  const { data: teams } = await supabase.from('teams').select('*, school:schools(*)').eq('active', true)
  const { data: seasons } = await supabase.from('seasons').select('*').order('year', { ascending: false })

  return (
    <AdminLayout>
      <div className="p-4 max-w-4xl">
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>Submission Queue</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          Review public score submissions before publishing.
        </p>
        <SubmissionQueue
          submissions={submissions || []}
          sports={sports || []}
          teams={teams || []}
          seasons={seasons || []}
        />
      </div>
    </AdminLayout>
  )
}
