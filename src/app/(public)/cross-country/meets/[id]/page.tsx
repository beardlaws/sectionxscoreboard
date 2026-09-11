import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import PublicLayout from '@/components/layout/PublicLayout'
import { getCrossCountryMeetRepository } from '@/lib/data/runtime-cross-country-meet-repository'
import { xcTeamName } from '@/lib/cross-country'
import { format, parseISO } from 'date-fns'

export const revalidate = 60

export async function generateMetadata({params}:{params:{id:string}}):Promise<Metadata>{
  const meet=await getCrossCountryMeetRepository().getMeet(params.id)
  if(!meet)return {}
  return {title:`${meet.meet_name} Cross Country Results`,description:`Section X cross country results from ${meet.meet_name} on ${meet.meet_date}.`}
}

function TeamTable({label,rows}:{label:string;rows:any[]}){
  return <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
    <div className="px-5 py-4 border-b border-white/[0.06] flex items-end justify-between gap-3">
      <div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-300/70">{label}</div><h2 className="mt-1 text-xl font-black text-white">Team Results</h2></div>
      <div className="text-[10px] font-black uppercase tracking-wider text-white/25">Low score wins</div>
    </div>
    {rows.length?<div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="border-b border-white/[0.05] text-white/35"><th className="text-center px-4 py-3 w-16">Place</th><th className="text-left px-3 py-3">Team</th><th className="text-right px-5 py-3">Score</th></tr></thead>
      <tbody>{rows.map((r:any)=><tr key={r.id} className="border-b last:border-b-0 border-white/[0.04]">
        <td className="text-center px-4 py-3 font-black text-white/60">{r.finish_place ?? '—'}</td>
        <td className="px-3 py-3">
          {r.team?.slug?<Link href={`/teams/${r.team.slug}`} className="font-black text-white hover:text-lime-300">{xcTeamName(r)}</Link>:r.team?.school?.slug?<Link href={`/schools/${r.team.school.slug}`} className="font-black text-white hover:text-lime-300">{xcTeamName(r)}</Link>:<span className="font-black text-white/75">{xcTeamName(r)}</span>}
          {r.is_section_x&&<span className="ml-2 text-[9px] uppercase tracking-wider text-blue-300/60">Section X</span>}
        </td>
        <td className="text-right px-5 py-3 text-xl font-black font-mono text-white">{r.team_score ?? '—'}</td>
      </tr>)}</tbody>
    </table></div>:<div className="p-6 text-sm text-white/30">No team results reported.</div>}
  </section>
}

function DualTable({label,rows}:{label:string;rows:any[]}) {
  return <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
    <div className="px-5 py-4 border-b border-white/[0.06] flex items-end justify-between gap-3">
      <div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-300/70">{label}</div><h2 className="mt-1 text-xl font-black text-white">League Dual Results</h2></div>
      <div className="text-[10px] font-black uppercase tracking-wider text-white/25">Low score wins</div>
    </div>
    {rows.length ? <div className="divide-y divide-white/[0.04]">
      {rows.map((r:any)=>{
        const aName=r.team_a?.school?.school_name||r.team_a?.team_name||'Team A'
        const bName=r.team_b?.school?.school_name||r.team_b?.team_name||'Team B'
        const aWin=r.outcome_a==='W', bWin=r.outcome_a==='L'
        return <div key={r.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4">
          <div className="min-w-0">
            <div className={`font-black ${aWin?'text-lime-300':'text-white/80'}`}>{r.team_a?.slug?<Link href={`/teams/${r.team_a.slug}`} className="hover:text-lime-300">{aName}</Link>:aName}</div>
            <div className="mt-1 text-2xl font-black font-mono text-white">{r.team_a_score ?? 'INC'}</div>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white/20">vs</div>
          <div className="min-w-0 text-right">
            <div className={`font-black ${bWin?'text-lime-300':'text-white/80'}`}>{r.team_b?.slug?<Link href={`/teams/${r.team_b.slug}`} className="hover:text-lime-300">{bName}</Link>:bName}</div>
            <div className="mt-1 text-2xl font-black font-mono text-white">{r.team_b_score ?? 'INC'}</div>
          </div>
          {r.notes&&<div className="col-span-3 text-xs text-white/35">{r.notes}</div>}
        </div>
      })}
    </div> : <div className="p-6 text-sm text-white/30">No league dual results reported.</div>}
  </section>
}

function IndividualTable({label,rows}:{label:string;rows:any[]}){
  if(!rows.length)return null
  const fmt=(v:any)=>{
    if(!v)return '—'
    const s=String(v)
    const m=s.match(/(\d{2}):(\d{2})(?:\.(\d+))?$/)
    return m?`${Number(m[1])}:${m[2]}`:s
  }
  return <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
    <div className="px-5 py-4 border-b border-white/[0.06]"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-300/70">{label}</div><h2 className="mt-1 text-xl font-black text-white">Individual Results</h2></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-white/35 border-b border-white/[0.05]"><th className="px-4 py-3 text-center">Place</th><th className="px-3 py-3 text-left">Runner</th><th className="px-3 py-3 text-left">Team</th><th className="px-5 py-3 text-right">Time</th></tr></thead>
    <tbody>{rows.map((r:any)=><tr key={r.id} className="border-b last:border-b-0 border-white/[0.04]"><td className="px-4 py-3 text-center font-black">{r.finish_place??'—'}</td><td className="px-3 py-3 font-bold text-white/80">{r.athlete?.display_name||r.runner_name||'Runner'}</td><td className="px-3 py-3 text-white/45">{r.team?.school?.school_name||r.external_opponent?.name||'—'}</td><td className="px-5 py-3 text-right font-mono text-white/70">{fmt(r.finish_time)}</td></tr>)}</tbody></table></div>
  </section>
}

export default async function CrossCountryMeetPage({params}:{params:{id:string}}){
  const repo=getCrossCountryMeetRepository()
  const [meet,teamRows,dualRows,individualRows]=await Promise.all([
    repo.getMeet(params.id),repo.getTeamResults(params.id),repo.getDualResults(params.id),repo.getIndividualResults(params.id)
  ])
  if(!meet)notFound()

  const boys=teamRows.filter((r:any)=>r.sport?.gender==='Boys')
  const girls=teamRows.filter((r:any)=>r.sport?.gender==='Girls')
  const boysDuals=dualRows.filter((r:any)=>r.sport?.gender==='Boys')
  const girlsDuals=dualRows.filter((r:any)=>r.sport?.gender==='Girls')
  const boysIndividuals=individualRows.filter((r:any)=>r.sport?.gender==='Boys')
  const girlsIndividuals=individualRows.filter((r:any)=>r.sport?.gender==='Girls')
  const date=format(parseISO(meet.meet_date+'T12:00:00'),'EEEE, MMMM d, yyyy')

  return <PublicLayout><main className="max-w-5xl mx-auto px-4 py-6">
    <div className="mb-6"><Link href="/sports/cross-country" className="text-xs font-black text-lime-300/70">← Cross Country</Link><div className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-lime-300/70">{meet.meet_type} · {meet.status}</div><h1 className="mt-1 text-3xl sm:text-4xl font-black text-white" style={{fontFamily:'var(--font-display)'}}>{meet.meet_name}</h1><p className="mt-2 text-sm text-white/40">{date}{meet.location?` · ${meet.location}`:''}</p>{meet.notes&&<p className="mt-3 text-sm text-white/50">{meet.notes}</p>}</div>
    <div className="rounded-2xl border border-lime-400/15 bg-lime-400/[0.035] px-4 py-3 mb-6 text-sm text-white/55"><span className="font-black text-lime-300">Cross country scoring:</span> the top five finishers score for each team, their places are added together, and the lowest total wins.</div>
    <div className="space-y-5">
      {meet.meet_type==='League'
        ? <><DualTable label="Boys Cross Country" rows={boysDuals}/><DualTable label="Girls Cross Country" rows={girlsDuals}/></>
        : <><TeamTable label="Boys Cross Country" rows={boys}/><TeamTable label="Girls Cross Country" rows={girls}/></>}
      <IndividualTable label="Boys Cross Country" rows={boysIndividuals}/>
      <IndividualTable label="Girls Cross Country" rows={girlsIndividuals}/>
    </div>
  </main></PublicLayout>
}
