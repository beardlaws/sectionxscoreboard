import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { xcTeamName } from '@/lib/cross-country'

export default function CrossCountryMeetCard({ meet, compact=false }: { meet:any; compact?:boolean }) {
  const results = meet.results || []
  const boys = results.filter((r:any) => r.sport?.gender === 'Boys').sort((a:any,b:any)=>(a.finish_place||999)-(b.finish_place||999))
  const girls = results.filter((r:any) => r.sport?.gender === 'Girls').sort((a:any,b:any)=>(a.finish_place||999)-(b.finish_place||999))
  const final = meet.status === 'Final'
  const live = meet.status === 'Live'
  const date = meet.meet_date ? format(parseISO(meet.meet_date+'T12:00:00'), 'MMM d') : ''

  const leader = (rows:any[]) => rows[0] ? `${xcTeamName(rows[0])} · ${rows[0].team_score ?? '—'}` : 'Results pending'

  return (
    <Link href={`/cross-country/meets/${meet.id}`} className="block group">
      <div className={`rounded-2xl overflow-hidden border border-lime-400/15 bg-lime-400/[0.035] transition-all group-hover:-translate-y-0.5 group-hover:border-lime-300/25 ${compact?'p-3':'p-4'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-lime-300">🏃 Cross Country · {meet.meet_type}</div>
            <div className="mt-1 font-black text-white truncate">{meet.meet_name}</div>
            <div className="mt-1 text-xs text-white/35">{date}{meet.location ? ` · ${meet.location}` : ''}</div>
          </div>
          <div className={`text-xs font-black whitespace-nowrap ${live?'text-red-400':final?'text-emerald-400':'text-blue-300'}`}>
            {live ? 'LIVE' : final ? 'FINAL' : String(meet.status || 'Scheduled').toUpperCase()}
          </div>
        </div>
        {final && (
          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.025] px-3 py-2">
              <div className="text-[9px] uppercase tracking-widest text-white/30">Boys leader</div>
              <div className="mt-1 text-sm font-black text-white/80 truncate">{leader(boys)}</div>
            </div>
            <div className="rounded-xl bg-white/[0.025] px-3 py-2">
              <div className="text-[9px] uppercase tracking-widest text-white/30">Girls leader</div>
              <div className="mt-1 text-sm font-black text-white/80 truncate">{leader(girls)}</div>
            </div>
          </div>
        )}
        <div className="mt-3 text-[10px] font-black uppercase tracking-wider text-lime-300/60">Low score wins · View full results →</div>
      </div>
    </Link>
  )
}
