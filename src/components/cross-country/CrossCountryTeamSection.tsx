import Link from 'next/link'
import { createPublicClient as createClient } from '@/lib/supabase/public'

function formatTime(t:string|null){
  if(!t)return 'TBD'
  const [hh,mm]=String(t).split(':').map(Number)
  const suffix=hh>=12?'PM':'AM'
  return (hh%12||12)+':'+String(mm||0).padStart(2,'0')+' '+suffix
}

export default async function CrossCountryTeamSection({teamId,sportId,seasonId}:{teamId:string;sportId:string;seasonId:string}){
  const db=createClient()
  const {data:myRows}=await db.from('cross_country_team_results').select('id,meet_id,team_score,finish_place,meet:cross_country_meets(id,meet_name,meet_date,meet_time,location,status,meet_type,season_id)').eq('team_id',teamId).eq('sport_id',sportId)
  const entries=(myRows||[]).map((r:any)=>({...r,meet:Array.isArray(r.meet)?r.meet[0]:r.meet})).filter((r:any)=>r.meet?.season_id===seasonId).sort((a:any,b:any)=>String(a.meet.meet_date).localeCompare(String(b.meet.meet_date)))
  const finalEntries=entries.filter((r:any)=>r.meet?.status==='Final')
  const upcoming=entries.filter((r:any)=>['Scheduled','Live','Postponed'].includes(r.meet?.status))
  let leagueWins=0,leagueLosses=0,leagueTies=0
  const leagueFinals=finalEntries.filter((r:any)=>r.meet?.meet_type==='League'&&r.team_score!=null)
  if(leagueFinals.length){
    const meetIds=leagueFinals.map((r:any)=>r.meet_id)
    const {data:allRows}=await db.from('cross_country_team_results').select('meet_id,team_id,team_score,is_section_x').in('meet_id',meetIds).eq('sport_id',sportId)
    for(const mine of leagueFinals){
      for(const opp of (allRows||[]).filter((r:any)=>r.meet_id===mine.meet_id&&r.team_id&&r.team_id!==teamId&&r.is_section_x&&r.team_score!=null)){
        if(mine.team_score<opp.team_score)leagueWins++
        else if(mine.team_score>opp.team_score)leagueLosses++
        else leagueTies++
      }
    }
  }

  return <div className="space-y-6">
    <div className="rounded-2xl border border-lime-400/15 bg-lime-400/[0.035] p-4">
      <div className="text-[10px] font-black uppercase tracking-[.16em] text-lime-300/70">Cross Country Record</div>
      <div className="mt-2 flex items-end gap-5">
        <div><div className="text-3xl font-black text-white">{leagueWins}</div><div className="text-[10px] text-white/35 uppercase">Wins</div></div>
        <div><div className="text-3xl font-black text-white">{leagueLosses}</div><div className="text-[10px] text-white/35 uppercase">Losses</div></div>
        {leagueTies>0&&<div><div className="text-3xl font-black text-white">{leagueTies}</div><div className="text-[10px] text-white/35 uppercase">Ties</div></div>}
      </div>
      <div className="mt-2 text-xs text-white/35">League meets only. Invitational finishes do not affect W-L.</div>
    </div>

    <section id="schedule" className="scroll-mt-24">
      <div className="flex items-center gap-2 mb-3"><span className="font-black text-xs text-blue-400 uppercase tracking-widest">Upcoming Meets {upcoming.length ? '· '+upcoming.length : ''}</span><div className="flex-1 h-px bg-white/5"/></div>
      {upcoming.length ? <div className="rounded-2xl overflow-hidden border border-white/6" style={{background:'rgba(8,12,20,.7)'}}>
        {upcoming.map((r:any)=><Link key={r.id} href={'/cross-country/meets/'+r.meet.id} className="block px-4 py-3 border-b last:border-b-0 border-white/[.04] hover:bg-white/[.03]">
          <div className="flex justify-between gap-4"><div><div className="font-semibold text-slate-200">{r.meet.meet_name}</div><div className="text-xs text-slate-500 mt-1">{r.meet.location||'Location TBD'} · {r.meet.meet_type}</div></div><div className="text-right"><div className="text-xs text-slate-400">{r.meet.meet_date}</div><div className="text-xs font-bold text-blue-400">{formatTime(r.meet.meet_time)}</div></div></div>
        </Link>)}
      </div> : <div className="rounded-2xl p-6 text-center border border-white/6 text-sm text-slate-500" style={{background:'rgba(8,12,20,.55)'}}>No upcoming meets currently listed.</div>}
    </section>

    <section>
      <div className="flex items-center gap-2 mb-3"><span className="font-black text-xs text-slate-400 uppercase tracking-widest">Meet Results {finalEntries.length ? '· '+finalEntries.length : ''}</span><div className="flex-1 h-px bg-white/5"/></div>
      {finalEntries.length ? <div className="rounded-2xl overflow-hidden border border-white/6" style={{background:'rgba(8,12,20,.7)'}}>
        {[...finalEntries].reverse().map((r:any)=><Link key={r.id} href={'/cross-country/meets/'+r.meet.id} className="flex items-center justify-between gap-4 px-4 py-3 border-b last:border-b-0 border-white/[.04] hover:bg-white/[.03]">
          <div><div className="font-semibold text-slate-200">{r.meet.meet_name}</div><div className="text-xs text-slate-500 mt-1">{r.meet.meet_date} · {r.meet.meet_type}</div></div><div className="text-right">{r.team_score!=null&&<div className="text-lg font-black text-white">{r.team_score}</div>}<div className="text-xs text-lime-300">{r.finish_place ? '#'+r.finish_place : 'Final'}</div></div>
        </Link>)}
      </div> : <div className="rounded-2xl p-6 text-center border border-white/6 text-sm text-slate-500" style={{background:'rgba(8,12,20,.55)'}}>No final meet results yet.</div>}
    </section>
  </div>
}