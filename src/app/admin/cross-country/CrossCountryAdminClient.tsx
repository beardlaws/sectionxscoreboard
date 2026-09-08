'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

function rowsToText(rows:any[]){
  return (rows||[]).sort((a,b)=>(a.finish_place||999)-(b.finish_place||999)).map((r:any)=>{
    const name=r.team?.school?.school_name||r.team?.team_name||r.external_opponent?.name||'Unknown'
    return `${name} ${r.team_score ?? ''}`.trim()
  }).join('\n')
}

export default function CrossCountryAdminClient({meets}:{meets:any[]}){
  const router=useRouter()
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState('')
  const [form,setForm]=useState<any>({id:null,meetName:'',meetDate:'',location:'',meetType:'Invitational',status:'Final',notes:'',boysResults:'',girlsResults:''})

  const ordered=useMemo(()=>[...(meets||[])].sort((a,b)=>String(b.meet_date).localeCompare(String(a.meet_date))),[meets])

  const set=(key:string,value:any)=>setForm((p:any)=>({...p,[key]:value}))
  const reset=()=>setForm({id:null,meetName:'',meetDate:'',location:'',meetType:'Invitational',status:'Final',notes:'',boysResults:'',girlsResults:''})
  const edit=(meet:any)=>{
    const results=meet.results||[]
    setForm({
      id:meet.id,meetName:meet.meet_name,meetDate:meet.meet_date,location:meet.location||'',meetType:meet.meet_type,status:meet.status,notes:meet.notes||'',
      boysResults:rowsToText(results.filter((r:any)=>r.sport?.gender==='Boys')),
      girlsResults:rowsToText(results.filter((r:any)=>r.sport?.gender==='Girls')),
    })
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const save=async()=>{
    setSaving(true);setMessage('')
    try{
      const res=await fetch('/api/admin/cross-country',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(form)})
      const data=await res.json()
      if(!res.ok||!data.ok)throw new Error(data.error||'Save failed')
      setMessage('Saved. Cross country results are ready for the public site.')
      reset()
      router.refresh()
    }catch(e:any){setMessage(e?.message||'Could not save meet.')}
    finally{setSaving(false)}
  }

  return <div className="space-y-6">
    <section className="rounded-2xl p-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
      <div className="flex items-end justify-between gap-3 mb-4"><div><h2 className="text-xl font-black text-white">{form.id?'Edit Meet':'Add Meet'}</h2><p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Paste team results one per line as Team Name + Score. Order determines finish place.</p></div>{form.id&&<button onClick={reset} className="text-xs font-bold text-blue-300">New meet</button>}</div>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="text-xs" style={{color:'var(--text-secondary)'}}>Meet name<input className="input w-full mt-1" value={form.meetName} onChange={e=>set('meetName',e.target.value)} placeholder="Saranac Spartan Running Festival"/></label>
        <label className="text-xs" style={{color:'var(--text-secondary)'}}>Date<input type="date" className="input w-full mt-1" value={form.meetDate} onChange={e=>set('meetDate',e.target.value)}/></label>
        <label className="text-xs" style={{color:'var(--text-secondary)'}}>Location<input className="input w-full mt-1" value={form.location} onChange={e=>set('location',e.target.value)} placeholder="School / course"/></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs" style={{color:'var(--text-secondary)'}}>Meet type<select className="input w-full mt-1" value={form.meetType} onChange={e=>set('meetType',e.target.value)}><option>League</option><option>Invitational</option><option>Championship</option><option>Scrimmage</option></select></label><label className="text-xs" style={{color:'var(--text-secondary)'}}>Status<select className="input w-full mt-1" value={form.status} onChange={e=>set('status',e.target.value)}><option>Scheduled</option><option>Live</option><option>Final</option><option>Postponed</option><option>Canceled</option></select></label></div>
      </div>
      <label className="block text-xs mt-3" style={{color:'var(--text-secondary)'}}>Notes<textarea className="input w-full mt-1 min-h-[70px]" value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Optional notes"/></label>
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <label className="text-xs" style={{color:'var(--text-secondary)'}}>Boys results<textarea className="input w-full mt-1 min-h-[190px] font-mono text-xs" value={form.boysResults} onChange={e=>set('boysResults',e.target.value)} placeholder={"AuSable Valley 65\nNorwood-Norfolk 69\nMassena 75"}/></label>
        <label className="text-xs" style={{color:'var(--text-secondary)'}}>Girls results<textarea className="input w-full mt-1 min-h-[190px] font-mono text-xs" value={form.girlsResults} onChange={e=>set('girlsResults',e.target.value)} placeholder={"Saranac Central 33\nNorwood-Norfolk 63\nMassena 67"}/></label>
      </div>
      {message&&<div className="mt-3 text-sm" style={{color:message.startsWith('Saved')?'#86efac':'#fca5a5'}}>{message}</div>}
      <button onClick={save} disabled={saving||!form.meetName||!form.meetDate} className="mt-4 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-40" style={{background:'var(--accent)'}}>{saving?'Saving…':form.id?'Update Meet':'Save Meet'}</button>
    </section>

    <section className="rounded-2xl p-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
      <h2 className="text-lg font-black text-white mb-3">Cross Country Meets</h2>
      <div className="space-y-2">{ordered.length?ordered.map((m:any)=><div key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-3" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.05)'}}><div className="flex-1 min-w-0"><div className="font-bold text-white truncate">{m.meet_name}</div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{m.meet_date} · {m.meet_type} · {m.status} · {(m.results||[]).length} team results</div></div><a href={`/cross-country/meets/${m.id}`} target="_blank" className="text-xs font-bold text-lime-300">View</a><button onClick={()=>edit(m)} className="text-xs font-bold text-blue-300">Edit</button></div>):<div className="text-sm" style={{color:'var(--text-muted)'}}>No meets yet.</div>}</div>
    </section>
  </div>
}
