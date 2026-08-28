import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { createClient } from '@/lib/supabase/server'

export const revalidate=0
export const metadata={title:'Search | Section X Scoreboard',description:'Search Section X schools, teams and athletes.'}
const esc=(v:string)=>v.replace(/[,%()]/g,' ').trim()
export default async function SearchPage({searchParams}:{searchParams:{q?:string}}){
  const q=esc(String(searchParams?.q||'')).slice(0,60),supabase=createClient()
  let schools:any[]=[],teams:any[]=[],athletes:any[]=[]
  if(q.length>=2){
    const [s,t,a]=await Promise.all([
      supabase.from('schools').select('id,school_name,mascot,slug,city').or(`school_name.ilike.%${q}%,mascot.ilike.%${q}%`).limit(12),
      supabase.from('teams').select('id,team_name,slug,school:schools(school_name,slug),sport:sports(sport_name,gender)').ilike('team_name',`%${q}%`).limit(18),
      supabase.from('athletes').select('id,display_name,slug,school:schools(school_name,slug)').ilike('display_name',`%${q}%`).eq('active',true).limit(18),
    ]);schools=s.data||[];teams=t.data||[];athletes=a.data||[]
  }
  const total=schools.length+teams.length+athletes.length
  return <PublicLayout><div className="max-w-4xl mx-auto px-4 py-8"><div className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-300">Find anything</div><h1 className="mt-1 text-3xl font-black text-white">Search Section X</h1><form className="mt-5 flex gap-2"><input autoFocus name="q" defaultValue={q} placeholder="School, team or athlete…" className="input flex-1"/><button className="btn-primary px-5">Search</button></form>
  {q.length>0&&q.length<2&&<p className="mt-6 text-sm text-white/40">Type at least two characters.</p>}
  {q.length>=2&&<><div className="mt-6 text-xs text-white/35">{total} result{total===1?'':'s'} for “{q}”</div>{total===0?<div className="card mt-4 p-8 text-center text-white/40">No Section X matches yet.</div>:<div className="mt-5 space-y-7">
    {schools.length>0&&<section><h2 className="section-label mb-2">Schools</h2><div className="grid sm:grid-cols-2 gap-2">{schools.map(s=><Link key={s.id} href={`/schools/${s.slug}`} className="card p-4 hover:border-yellow-300/25"><b className="text-white">{s.school_name}</b><div className="text-xs text-white/40 mt-1">{[s.mascot,s.city].filter(Boolean).join(' · ')}</div></Link>)}</div></section>}
    {teams.length>0&&<section><h2 className="section-label mb-2">Teams</h2><div className="grid sm:grid-cols-2 gap-2">{teams.map((t:any)=>{const school=Array.isArray(t.school)?t.school[0]:t.school,sport=Array.isArray(t.sport)?t.sport[0]:t.sport;return <Link key={t.id} href={`/teams/${t.slug}`} className="card p-4 hover:border-yellow-300/25"><b className="text-white">{t.team_name}</b><div className="text-xs text-white/40 mt-1">{school?.school_name}{sport?.sport_name?` · ${sport.gender?`${sport.gender} `:''}${sport.sport_name}`:''}</div></Link>})}</div></section>}
    {athletes.length>0&&<section><h2 className="section-label mb-2">Athletes</h2><div className="grid sm:grid-cols-2 gap-2">{athletes.map((a:any)=>{const school=Array.isArray(a.school)?a.school[0]:a.school;return <Link key={a.id} href={`/athletes/${a.slug}`} className="card p-4 hover:border-yellow-300/25"><b className="text-white">{a.display_name}</b><div className="text-xs text-white/40 mt-1">{school?.school_name||'Section X athlete'}</div></Link>})}</div></section>}
  </div>}</>}</div></PublicLayout>
}
