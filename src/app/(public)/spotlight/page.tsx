import { createClient } from '@/lib/supabase/server'
import { Metadata } from 'next'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Section X Spotlight | Stories & Features',
  description: 'Athlete features, game recaps, and stories from Section X high school sports in Northern New York.',
}

export default async function SpotlightIndexPage() {
  const supabase = createClient()
  const { data: stories } = await supabase
    .from('spotlights').select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">📰</span>
          <div>
            <h1 className="text-3xl font-black text-white"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.04em' }}>
              Section X Spotlight
            </h1>
            <p className="text-slate-400 text-sm">Athlete features, game recaps, and North Country sports stories</p>
          </div>
        </div>

        {(!stories || stories.length === 0) && (
          <div className="rounded-2xl p-16 text-center border border-white/6"
            style={{ background: 'rgba(8,12,20,0.7)' }}>
            <p className="text-4xl mb-4">📰</p>
            <p className="text-white font-black text-xl" style={{ fontFamily: 'var(--font-display)' }}>
              Stories Coming Soon
            </p>
            <p className="text-slate-500 text-sm mt-2">
              Athlete features and game recaps will appear here.
            </p>
          </div>
        )}

        <div className="grid gap-4">
          {(stories || []).map((story: any) => (
            <Link key={story.id} href={`/spotlight/${story.id}`}
              className="rounded-2xl p-5 border transition-all hover:-translate-y-0.5 hover:shadow-xl group"
              style={{ background: 'rgba(8,12,20,0.8)', border: story.featured ? '1px solid rgba(37,99,235,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {story.featured && (
                      <span className="text-xs font-black text-blue-400 px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(37,99,235,0.15)', fontFamily: 'var(--font-display)' }}>
                        ⭐ Featured
                      </span>
                    )}
                    {story.sport_name && (
                      <span className="text-xs text-slate-500">{story.sport_name}</span>
                    )}
                  </div>
                  <h2 className="text-lg font-black text-white group-hover:text-blue-300 transition-colors mb-2"
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
                    {story.title}
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">
                    {story.body}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-slate-600">
                    <span>By {story.author}</span>
                    <span>·</span>
                    <span>{format(new Date(story.created_at), 'MMMM d, yyyy')}</span>
                  </div>
                </div>
                <span className="text-blue-400 font-bold text-sm flex-shrink-0 group-hover:text-blue-300 mt-1"
                  style={{ fontFamily: 'var(--font-display)' }}>
                  Read →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PublicLayout>
  )
}
