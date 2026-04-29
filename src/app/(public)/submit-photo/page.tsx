// src/app/(public)/submit-photo/page.tsx
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'
import SubmitPhotoForm from './SubmitPhotoForm'

export const metadata: Metadata = {
  title: 'Submit a Photo',
  description: 'Submit a sports photo for the Section X Scoreboard photo gallery.',
}

export default async function SubmitPhotoPage() {
  const supabase = createClient()
  const { data: schools } = await supabase.from('schools').select('id, school_name').eq('active', true).order('school_name')
  const { data: sports } = await supabase.from('sports').select('*').eq('active_public', true).order('sport_name')

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Submit a Photo
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Share your Section X sports photos. All submissions are reviewed before publishing. Photographer credit is always given.
        </p>
        <SubmitPhotoForm schools={schools || []} sports={sports || []} />
      </div>
    </PublicLayout>
  )
}
