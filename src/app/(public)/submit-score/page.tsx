// src/app/(public)/submit-score/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'
import SubmitScoreForm from './SubmitScoreForm'

export const metadata: Metadata = {
  title: 'Submit a Score',
  description: 'Submit a Section X sports score for review.',
}

export default async function SubmitScorePage() {
  const supabase = createClient()
  const { data: sports } = await supabase.from('sports').select('*').eq('active_public', true).order('sport_name')
  const { data: schools } = await supabase.from('schools').select('id, school_name, slug').eq('active', true).order('school_name')

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Submit a Score
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          All submissions are reviewed before publishing. Thank you for helping keep Section X scores accurate.
        </p>
        <SubmitScoreForm sports={sports || []} schools={schools || []} />
      </div>
    </PublicLayout>
  )
}
