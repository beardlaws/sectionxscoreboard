import { getCloudflareContext } from '@opennextjs/cloudflare'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic='force-dynamic'

export default async function MeetPage({params}:{params:{id:string}}){
 const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
 const event:any=await db.prepare(`SELECT g.id,g.event_name,g.event_format,g.game_date,g.game_time,g.location,g.status,g.counts_for_standings,g.notes,s.sport_name,s.gender FROM games g LEFT JOIN sports s ON s.id=g.sport_id WHERE g.id=? AND g.event_format IN ('meet','invitational') LIMIT 1`).bind(params.id).first()
 if(!event)notFound()
 const result=await db.prepare(`SELECT r.id,r.team_id,r.display_name,r.placement,r.score,r.points,r.notes,t.team_name,t.slug AS team_slug,sc.school_name,sc.slug AS school_slug,sc.primary_color FROM event_team_results r LEFT JOIN teams t ON t.id=r.team_id LEFT JOIN schools sc ON sc.id=t.school_id WHERE r.game_id=? ORDER BY COALESCE(r.placement,9999),COALESCE(r.score,999999),COALESCE(sc.school_name,r.display_name)`).bind(params.id).all(),rows:any[]=result.results||[]
 const sport=event.gender&&event.gender!=='Both'?`${event.gender} ${event.sport_name}`:event.sport_name
 return <main className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
  <div className="card overflow-hidden"><div className="p-5 md:p-7 border-b border-white/10"><div className="text-xs uppercase tracking-widest font-black text-blue-300">{event.event_format==='invitational'?'Invitational':'Meet'}</div><h1 className="text-3xl md:text-4xl font-black text-white mt-1" style={{fontFamily:'var(--font-display)'}}>{event.event_name}</h1><div className="text-sm text-slate-400 mt-2 flex flex-wrap gap-x-3 gap-y-1"><span>{sport}</span><span>{event.game_date}{event.game_time?` · ${String(event.game_time).slice(0,5)}`:''}</span>{event.location&&<span>{event.location}</span>}<span>{event.status}</span></div>{!event.counts_for_standings&&<div className="mt-3 text-xs text-emerald-300">Invitational result · does not alter regular W-L standings</div>}</div>
   <div className="divide-y divide-white/5">{rows.map((r,i)=>{const name=r.school_name||r.team_name||r.display_name||'Team';const content=<><div className="w-10 text-center text-xl font-black text-white">{r.placement??i+1}</div><div className="flex-1 min-w-0"><div className="font-bold text-white truncate">{name}</div>{r.notes&&<div className="text-xs text-slate-500 mt-0.5">{r.notes}</div>}</div><div className="text-right"><div className="text-xl font-black text-white" style={{fontFamily:'var(--font-scoreboard)'}}>{r.score??r.points??'—'}</div>{r.score!=null&&r.points!=null&&<div className="text-[10px] text-slate-500">{r.points} pts</div>}</div></>;return r.team_slug?<Link href={`/teams/${r.team_slug}`} key={r.id} className="p-4 flex items-center gap-3 hover:bg-white/[0.03]">{content}</Link>:<div key={r.id} className="p-4 flex items-center gap-3">{content}</div>})}</div>
  </div>
  {event.notes&&<div className="card p-4"><div className="text-xs uppercase tracking-widest text-slate-500 font-black">Meet Notes</div><p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{event.notes}</p></div>}
 </main>
}
