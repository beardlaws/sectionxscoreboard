import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { format } from 'date-fns'

interface Props { params: { id: string } }

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase.from('spotlights').select('title, body').eq('id', params.id).single()
  if (!data) return {}
  return {
    title: `${data.title} | Section X Spotlight`,
    description: data.body?.slice(0, 160),
  }
}

export default async function SpotlightStoryPage({ params }: Props) {
  const supabase = createClient()
  const { data: story } = await supabase
    .from('spotlights').select('*')
    .eq('id', params.id).eq('published', true).single()

  if (!story) notFound()

  // Get other recent stories for sidebar
  const { data: others } = await supabase
    .from('spotlights').select('id, title, created_at')
    .eq('published', true).neq('id', params.id)
    .order('created_at', { ascending: false }).limit(4)

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
          <Link href="/" className="hover:text-white">Home</Link>
          <span>/</span>
          <Link href="/spotlight" className="hover:text-white">Spotlight</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-secondary)' }} className="truncate max-w-xs">{story.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main story */}
          <div className="lg:col-span-2">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-black text-blue-400 uppercase tracking-widest"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.12em' }}>
                  📰 Section X Spotlight
                </span>
                {story.sport_name && (
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(37,99,235,0.15)', color: '#60a5fa' }}>
                    {story.sport_name}
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
                {story.title}
              </h1>
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                <span>By {story.author}</span>
                <span>·</span>
                <span>{format(new Date(story.created_at), 'MMMM d, yyyy')}</span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px mb-6" style={{ background: 'rgba(255,255,255,0.08)' }} />

            {/* Body */}
            <div className="prose prose-invert max-w-none">
              {story.body.split('\n').filter(Boolean).map((paragraph: string, i: number) => (
                <p key={i} className="text-slate-300 leading-relaxed mb-4 text-base">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 flex items-center justify-between flex-wrap gap-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <Link href="/spotlight"
                className="text-sm text-blue-400 hover:text-blue-300 font-bold transition-colors"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
                ← All Stories
              </Link>
              <Link href="/submit-score"
                className="btn-primary text-sm">
                Submit a Score
              </Link>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {others && others.length > 0 && (
              <div className="rounded-2xl p-4 border border-white/8"
                style={{ background: 'rgba(8,12,20,0.7)' }}>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
                  style={{ fontFamily: 'var(--font-display)' }}>More Stories</p>
                <div className="space-y-3">
                  {others.map((s: any) => (
                    <Link key={s.id} href={`/spotlight/${s.id}`}
                      className="block group">
                      <p className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors leading-snug"
                        style={{ fontFamily: 'var(--font-display)' }}>
                        {s.title}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {format(new Date(s.created_at), 'MMM d, yyyy')}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl p-4 border border-white/8"
              style={{ background: 'rgba(8,12,20,0.7)' }}>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3"
                style={{ fontFamily: 'var(--font-display)' }}>Quick Links</p>
              <div className="space-y-1">
                {[
                  { href: '/scores', label: '📅 Scores' },
                  { href: '/standings', label: '📊 Standings' },
                  { href: '/playoffs', label: '🏆 Playoffs' },
                  { href: '/submit-score', label: '✏️ Submit a Score' },
                ].map(l => (
                  <Link key={l.href} href={l.href}
                    className="block text-sm text-slate-400 hover:text-white transition-colors py-1">
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
