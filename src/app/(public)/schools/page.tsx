// src/app/(public)/schools/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PublicLayout from '@/components/layout/PublicLayout'

export const metadata: Metadata = {
  title: 'Schools',
  description: 'All Section X high school programs and teams.',
}

export const revalidate = 3600

export default async function SchoolsPage() {
  const supabase = createClient()
  const { data: schools } = await supabase
    .from('schools')
    .select('*')
    .eq('active', true)
    .order('school_name')

  const byCounty: Record<string, typeof schools> = {}
  for (const school of schools || []) {
    if (!byCounty[school.county]) byCounty[school.county] = []
    byCounty[school.county]!.push(school)
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          Section X Schools
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {schools?.length || 0} member schools in Northern New York
        </p>

        {Object.entries(byCounty).sort().map(([county, countySchools]) => (
          <section key={county} className="mb-8">
            <h2 className="section-label mb-3">{county} County</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {countySchools?.map(school => (
                <Link
                  key={school.id}
                  href={`/schools/${school.slug}`}
                  className="card-hover p-4 flex items-center gap-3"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                    style={{
                      background: school.primary_color || '#1e2d47',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {school.alias?.slice(0, 2) || school.school_name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate" style={{ fontFamily: 'var(--font-display)', fontSize: '14px' }}>
                      {school.school_name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {school.mascot} · {school.city}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PublicLayout>
  )
}
