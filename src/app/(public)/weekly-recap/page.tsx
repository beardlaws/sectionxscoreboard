import type { Metadata } from 'next'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import FacebookVideo from '@/components/weekly-recap/FacebookVideo'
import { createPublicClient as createClient } from '@/lib/supabase/public'

export const metadata: Metadata = { title: 'Weekly Recap | Section X Scoreboard', description: 'Watch the Section X Scoreboard Weekly Recap for the biggest scores, performances, and storylines from Northern New York high school sports.' }
export const revalidate = 60

export default async function WeeklyRecapPage() {
  const db = createClient()
  const { data } = await db.from('weekly_recaps').select('*').eq('published', true).order('published_date', { ascending: false }).order('created_at', { ascending: false })
  const recaps = data || []
  const latest = recaps[0]
  return <PublicLayout><main className="max-w-5xl mx-auto px-4 py-6 md:py-10">
    <div className="mb-6"><div className="text-xs font-black uppercase tracking-[.18em] text-blue-400 mb-2">Section X Scoreboard</div><h1 className="text-3xl md:text-5xl font-black text-white" style={{fontFamily:'var(--font-display)'}}>Weekly Recap</h1><p className="text-slate-400 mt-2 max-w-2xl">One video. The biggest scores, performances and storylines from the week in Section X sports.</p></div>
    {!latest ? <div className="card p-8 text-slate-400">The first Weekly Recap is coming soon.</div> : <>
      <article className="card overflow-hidden mb-8"><div className="p-4 md:p-6"><div className="flex gap-2 text-xs font-black uppercase tracking-wider text-blue-400 mb-2"><span>{latest.season_label}</span><span className="text-slate-600">·</span><span>{latest.week_label}</span></div><h2 className="text-2xl md:text-3xl font-black text-white mb-2" style={{fontFamily:'var(--font-display)'}}>{latest.title}</h2>{latest.summary&&<p className="text-slate-400 mb-5">{latest.summary}</p>} {latest.facebook_embed_url ? <FacebookVideo src={latest.facebook_embed_url} title={latest.title} /> : latest.facebook_url ? <Link href={latest.facebook_url} target="_blank" className="btn-primary inline-flex">Watch on Facebook</Link> : null}</div></article>
      {recaps.length>1&&<section><h2 className="text-lg font-black text-white mb-3" style={{fontFamily:'var(--font-display)'}}>Previous Recaps</h2><div className="grid md:grid-cols-2 gap-3">{recaps.slice(1).map((r:any)=><a key={r.id} href={r.facebook_url||'#'} target="_blank" rel="noopener noreferrer" className="card p-4 hover:border-blue-500/40 transition-colors"><div className="text-xs text-blue-400 font-black uppercase tracking-wider">{r.season_label} · {r.week_label}</div><div className="text-white font-black mt-1">{r.title}</div><div className="text-sm text-slate-500 mt-1">{r.summary}</div></a>)}</div></section>}
    </>}
  </main></PublicLayout>
}
