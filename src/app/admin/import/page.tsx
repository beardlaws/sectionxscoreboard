// src/app/admin/import/page.tsx
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
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
    supabase.from('teams').select('*, school:schools(school_name, alias, primary_color, slug)'),
    supabase.from('sports').select('*').order('sport_name'),
    supabase.from('seasons').select('*').order('year', { ascending: false }),
  ])

  return (
    <AdminLayout>
      <div className="px-4 pt-4 max-w-6xl">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} className="text-emerald-300 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-emerald-100">Entering tonight's final scores?</div>
              <div className="text-sm text-emerald-100/75 mt-1">
                Use Safe Score Intake. It matches existing scheduled games only, protects scores already entered, and can never create a new game.
              </div>
            </div>
          </div>
          <Link href="/admin/score-intelligence" className="admin-action-btn justify-center whitespace-nowrap">
            Open Safe Score Intake
          </Link>
        </div>
      </div>
      <ImportCenter teams={teams || []} sports={sports || []} seasons={seasons || []} />
    </AdminLayout>
  )
}
