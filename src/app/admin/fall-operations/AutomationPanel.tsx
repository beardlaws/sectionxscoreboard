import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldCheck } from 'lucide-react'

function statusTone(status:string){
  if(status==='completed')return {label:'Healthy',className:'text-emerald-300',dot:'bg-emerald-400'}
  if(status==='running')return {label:'Running',className:'text-sky-300',dot:'bg-sky-400'}
  if(status==='completed-with-errors')return {label:'Completed with errors',className:'text-amber-300',dot:'bg-amber-400'}
  return {label:'Failed',className:'text-red-300',dot:'bg-red-400'}
}

function fmt(value:string|null|undefined){
  if(!value)return '—'
  return new Date(value).toLocaleString('en-US',{timeZone:'America/New_York',month:'numeric',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})
}

export default function AutomationPanel({runs,cron}:{runs:any[];cron:any|null}){
  const latest=runs?.[0]||null
  const tone=statusTone(latest?.status||'failed')
  const s=latest?.summary||{}
  const schedule=s.schedule||{},scores=s.scores||{},rosters=s.rosters||{}
  const changed=Number(schedule.updated||0)+Number(schedule.created||0)+Number(schedule.deletedMarked||0)+Number(scores.updated||0)
  const enabled=Boolean(cron?.active)

  return <div className="card p-4 space-y-4">
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className={enabled?'text-emerald-300':'text-amber-300'}/>
          <h2 className="font-semibold text-white">Arbiter Automation</h2>
          <span className={`text-[10px] px-2 py-1 rounded-full border ${enabled?'text-emerald-300 border-emerald-500/30 bg-emerald-500/10':'text-amber-300 border-amber-500/30 bg-amber-500/10'}`}>{enabled?'ACTIVE':'INACTIVE'}</span>
        </div>
        <p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Secure Supabase scheduler → Arbiter Partner API → safety reconciliation → controlled automatic upsert.</p>
      </div>
      <div className="text-xs lg:text-right" style={{color:'var(--text-muted)'}}>
        <div>5 checks daily</div>
        <div className="text-white mt-1">7 AM · 11 AM · 3 PM · 7 PM · 10 PM ET</div>
      </div>
    </div>

    {latest ? <>
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${tone.dot}`}/><b className={tone.className}>Latest automatic run: {tone.label}</b></div>
          <div className="text-xs" style={{color:'var(--text-muted)'}}>{fmt(latest.started_at)}{latest.finished_at?` · finished ${fmt(latest.finished_at)}`:''}</div>
        </div>
        {latest.status==='running' ? <div className="flex items-center gap-2 text-sky-300 text-sm"><RefreshCw size={15} className="animate-spin"/>Arbiter reconciliation is running now.</div> : latest.status==='failed' ? <div className="flex items-start gap-2 text-red-300 text-sm"><AlertTriangle size={15} className="mt-0.5"/><span>{s.error||'Automatic run failed. Review runtime logs before retrying.'}</span></div> : <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div className="rounded bg-black/20 p-3"><b className="text-white">{Number(schedule.stableLinks||0)}</b><div style={{color:'var(--text-muted)'}}>Stable links checked</div></div>
          <div className="rounded bg-black/20 p-3"><b className="text-white">{changed}</b><div style={{color:'var(--text-muted)'}}>Changes applied</div></div>
          <div className="rounded bg-black/20 p-3"><b className="text-white">{Number(scores.updated||0)}</b><div style={{color:'var(--text-muted)'}}>Scores applied</div></div>
          <div className="rounded bg-black/20 p-3"><b className="text-white">{Number(schedule.failed||0)+Number(scores.failed||0)}</b><div style={{color:'var(--text-muted)'}}>Write failures</div></div>
        </div>}
        {latest.status!=='running'&&latest.status!=='failed'&&<div className="text-xs mt-3 flex flex-wrap gap-x-4 gap-y-1" style={{color:'var(--text-muted)'}}>
          <span>Schedule: {Number(schedule.updated||0)} updated · {Number(schedule.created||0)} created · {Number(schedule.deletedMarked||0)} cancelled</span>
          <span>Rosters: {Number(rosters.loaded||0)}/{Number(rosters.varsityTeams||0)} loaded</span>
          <span>Quarantined: {Number(schedule.quarantined||0)}</span>
          <span>Blockers: {Number(schedule.blockers||0)}</span>
        </div>}
      </div>
    </> : <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-300 text-sm">Automation is configured but no automatic run has been recorded yet.</div>}

    <div>
      <div className="flex items-center gap-2 mb-2"><Clock3 size={16}/><h3 className="text-sm font-semibold text-white">Automatic run history</h3></div>
      <div className="space-y-2">
        {(runs||[]).slice(0,8).map((run:any)=>{const t=statusTone(run.status),rs=run.summary||{},sch=rs.schedule||{},sc=rs.scores||{};const changes=Number(sch.updated||0)+Number(sch.created||0)+Number(sch.deletedMarked||0)+Number(sc.updated||0);return <div key={run.id} className="rounded border border-white/10 bg-black/20 p-3 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${t.dot}`}/><b className={t.className}>{t.label}</b><span style={{color:'var(--text-muted)'}}>{fmt(run.started_at)}</span></div>
          <div className="flex gap-4" style={{color:'var(--text-muted)'}}><span>{changes} changes</span><span>{Number(sch.blockers||0)} blockers</span><span>{Number(sch.quarantined||0)} quarantined</span></div>
        </div>})}
      </div>
    </div>

    <div className="flex items-start gap-2 text-xs rounded border border-white/10 bg-black/20 p-3" style={{color:'var(--text-muted)'}}><CheckCircle2 size={15} className="text-emerald-300 mt-0.5 shrink-0"/><span>Only rows already classified safe by Schedule Intelligence are automatically changed. TBA, ambiguous matches, event sports, mapping problems, manual score conflicts and other quarantined records remain untouched.</span></div>
  </div>
}
