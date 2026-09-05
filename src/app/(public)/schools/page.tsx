// src/app/(public)/schools/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { createPublicClient as createClient } from '@/lib/supabase/public'
import PublicLayout from '@/components/layout/PublicLayout'

export const metadata: Metadata = {
  title: 'Section X Schools | All 24 Member Schools',
  description: 'All 24 Section X high school athletic programs in St. Lawrence and Franklin County, Northern New York. Canton, Massena, Gouverneur, Ogdensburg, Heuvelton, and more.',
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
              {countySchools?.map(school => {
                const logoUrl = (school as any).logo_url as string | null
                const initials = school.alias?.slice(0, 3) ||
                  school.school_name
                    .split(' ')
                    .filter((w: string) => !['Central', 'School', 'Free', 'Academy', 'High', 'of'].includes(w))
                    .map((w: string) => w[0])
                    .join('')
                    .slice(0, 3)
                    .toUpperCase()

                return (
                  <Link key={school.id} href={`/schools/${school.slug}`}
                    className="card-hover p-4 flex items-center gap-3">
                    {/* Logo or colored initials */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10"
                      style={{ background: school.primary_color || '#1e2d47' }}>
                      {logoUrl ? (
                        <img src={logoUrl} alt={school.school_name}
                          className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="font-black text-white text-xs"
                          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
                          {initials}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate"
                        style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--text-primary)' }}>
                        {school.school_name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {school.mascot} · {school.city}
                      </div>
                      {/* Color dots */}
                      <div className="flex items-center gap-1 mt-1">
                        {school.primary_color && (
                          <div className="w-2 h-2 rounded-full border border-white/10"
                            style={{ background: school.primary_color }} />
                        )}
                        {school.secondary_color && (
                          <div className="w-2 h-2 rounded-full border border-white/10"
                            style={{ background: school.secondary_color }} />
                        )}
                        {logoUrl && (
                          <span className="text-xs text-emerald-400 ml-1" style={{ fontSize: '10px' }}>✓</span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </PublicLayout>
  )
}
