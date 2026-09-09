import type { Metadata } from 'next'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import CrossCountryMeetCard from '@/components/scores/CrossCountryMeetCard'
import { createPublicClient as createClient } from '@/lib/supabase/public'
import { calculateCrossCountryStandings } from '@/lib/cross-country'

export const metadata: Metadata = {
  title: 'Cross Country Scores & Standings',
  description: 'Section X boys and girls cross country meet results, schedules and league standings.',
}

export const revalidate = 60

function StandingsTable({ title, rows }: { title:string; rows:any[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-300/70">{title}</div>
        <div className="mt-1 text-xs text-white/30">League meets only · lower team score wins head-to-head</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-white/35 border-b border-white/[0.05]"><th className="text-left px-4 py-2">Team</th><th className="text-center px-2 py-2">W</th><th className="text-center px-2 py-2">L</th><th className="text-center px-2 py-2">Pct</th></tr></thead>
          <tbody>{rows.map((row:any)=><tr key={row.team_id} className="border-b last:border-b-0 border-white/[0.04]"><td className="px-4 py-2.5"><Link href={row.team_slug ? `/teams/${row.team_slug}` : `/schools/${row.school_slug}`} className="font-bold text-white/80 hover:text-lime-300">{row.school_name}</Link></td><td className="text-center font-mono text-white/70">{row.wins}</td><td className="text-center font-mono text-white/70">{row.losses}</td><td className="text-center font-mono text-white/50">{row.win_pct.toFixed(3)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

export default async function CrossCountryPage() {
  const db = createClient()
  const [{data:season},{data:sports}] = await Promise.all([
    db.from('seasons').select('*').eq('is_active',true).single(),
    db.from('sports').select('*').in('slug',['boys-cross-country','girls-cross-country'])
  ])

  const sportRows = sports || []
  const boysSport = sportRows.find((s:any)=>s.slug==='boys-cross-country')
  const girlsSport = sportRows.find((s:any)=>s.slug==='girls-cross-country')
  const sportIds = sportRows.map((s:any)=>s.id)

  const [{data:meets},{data:results},{data:xcTeams},{data:dualResults}] = await Promise.all([
    season ? db.from('cross_country_meets').select('*').eq('season_id',season.id).order('meet_date',{ascending:true}) : Promise.resolve({data:[] as any[]}),
    sportIds.length ? db.from('cross_country_team_results').select(`*,sport:sports(id,slug,gender,sport_name),team:teams(id,team_name,slug,sport_id,school:schools(id,school_name,slug,is_section_x,primary_color,logo_url)),external_opponent:external_opponents(id,name,slug)`).in('sport_id',sportIds) : Promise.resolve({data:[] as any[]}),
    sportIds.length ? db.from('teams').select(`id,team_name,slug,sport_id,level,active,school:schools(id,school_name,slug,is_section_x)`).in('sport_id',sportIds).eq('active',true) : Promise.resolve({data:[] as any[]}),
    sportIds.length ? db.from('cross_country_dual_results').select('meet_id,sport_id,team_a_id,team_b_id,outcome_a').in('sport_id',sportIds) : Promise.resolve({data:[] as any[]})
  ])

  const allResults = results || []
  const meetRows = (meets || []).map((meet:any)=>({...meet,results:allResults.filter((r:any)=>r.meet_id===meet.id)}))
  const xcTeamSeasonShape = (xcTeams || []).filter((team:any)=>!team.level || team.level.toLowerCase().trim()==='varsity').map((team:any)=>({team}))
  const boysStandings = boysSport ? calculateCrossCountryStandings(meets||[],allResults,xcTeamSeasonShape,boysSport.id,dualResults||[]) : []
  const girlsStandings = girlsSport ? calculateCrossCountryStandings(meets||[],allResults,xcTeamSeasonShape,girlsSport.id,dualResults||[]) : []
  const finalMeets = meetRows.filter((m:any)=>m.status==='Final').sort((a:any,b:any)=>String(b.meet_date).localeCompare(String(a.meet_date)) || String(a.meet_time||'').localeCompare(String(b.meet_time||'')))
  const upcoming = meetRows.filter((m:any)=>m.status!=='Final' && m.status!=='Canceled').sort((a:any,b:any)=>String(a.meet_date).localeCompare(String(b.meet_date)) || String(a.meet_time||'').localeCompare(String(b.meet_time||'')))

  return (
    <PublicLayout>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-300/70">Section X Cross Country</div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-black text-white" style={{fontFamily:'var(--font-display)'}}>Cross Country</h1>
          <p className="mt-2 text-sm text-white/40">Boys and girls varsity meet results, schedules and league standings. In cross country, the lowest team score wins.</p>
          {season && <div className="mt-2 text-xs text-white/25">{season.name}</div>}
        </div>

        <div className="rounded-2xl border border-lime-400/15 bg-lime-400/[0.035] p-4 mb-6">
          <div className="text-xs font-black text-lime-300">HOW TEAM SCORING WORKS</div>
          <p className="mt-2 text-sm text-white/55 leading-relaxed">The first five finishers for each team score points equal to their finishing places. Those five places are added together, and the lowest total wins. Sixth and seventh runners can displace opposing scorers. A perfect team score is 15.</p>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          <section>
            <h2 className="text-sm font-black uppercase tracking-wider text-white/40 mb-3">Final Results</h2>
            {finalMeets.length ? <div className="space-y-3">{finalMeets.map((m:any)=><CrossCountryMeetCard key={m.id} meet={m}/>)}</div> : <div className="rounded-2xl border border-white/[0.06] p-8 text-center text-white/35">No final meets reported yet.</div>}
            {upcoming.length > 0 && <div className="mt-8"><h2 className="text-sm font-black uppercase tracking-wider text-white/40 mb-3">Upcoming Meets</h2><div className="space-y-3">{upcoming.map((m:any)=><CrossCountryMeetCard key={m.id} meet={m}/>)}</div></div>}
          </section>
          <aside className="space-y-4">
            <StandingsTable title="Boys Section X Standings" rows={boysStandings}/>
            <StandingsTable title="Girls Section X Standings" rows={girlsStandings}/>
          </aside>
        </div>
      </main>
    </PublicLayout>
  )
}
