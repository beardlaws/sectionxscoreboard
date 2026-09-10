// src/app/(public)/submit-score/page.tsx
import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'
import SubmitScoreForm from './SubmitScoreForm'
import { getSportsRepository } from '@/lib/data/runtime-sports-repository'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Submit a Score',
  description: 'Submit a Section X sports score for review.',
}

export default async function SubmitScorePage() {
  const repo = getSportsRepository()
  const [sportsData, schoolsData] = await Promise.all([repo.getSports(), repo.getSchools()])
  const sports = sportsData.filter((sport:any)=>sport.active_public !== false)
  const schools = schoolsData.map((school:any)=>({ id:school.id, school_name:school.school_name, slug:school.slug }))

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
