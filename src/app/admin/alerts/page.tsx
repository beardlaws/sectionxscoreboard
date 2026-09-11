// src/app/admin/alerts/page.tsx
'use client'
import { useEffect,useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { adminDb } from '@/lib/adminDb'
import { Download } from 'lucide-react'

export default function AlertsAdmin(){
 const [subs,setSubs]=useState<any[]>([]),[loading,setLoading]=useState(true),[filter,setFilter]=useState(''),[error,setError]=useState('')
 useEffect(()=>{void load()},[])
 async function load(){
  setLoading(true);setError('')
  try{
   const [subResult,schoolResult]=await Promise.all([
    adminDb.select('score_alert_subscriptions',{orderBy:'created_at',direction:'desc',limit:1000}),
    adminDb.select('schools',{columns:['id','school_name','slug'],limit:500})
   ])
   const schools=new Map((schoolResult.data||[]).map((s:any)=>[s.id,s]))
   setSubs((subResult.data||[]).map((s:any)=>({...s,all_section_x:Boolean(s.all_section_x),confirmed:Boolean(s.confirmed),school:s.school_id?schools.get(s.school_id)||null:null})))
  }catch(e:any){setError(e?.message||'Could not load subscribers.')}finally{setLoading(false)}
 }
 async function deleteSub(id:string){try{await adminDb.delete('score_alert_subscriptions',{id});await load()}catch(e:any){setError(e?.message||'Could not remove subscriber.')}}
 function exportCSV(){const rows=[['Email','School','All Section X','Signed Up'],...filtered.map(s=>[s.email,s.school?.school_name||(s.all_section_x?'All Section X':''),s.all_section_x?'Yes':'No',new Date(s.created_at).toLocaleDateString()])];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'),blob=new Blob([csv],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='score_alert_subscribers.csv';a.click();URL.revokeObjectURL(url)}
 const filtered=subs.filter(s=>!filter||s.email.toLowerCase().includes(filter.toLowerCase())||s.school?.school_name?.toLowerCase().includes(filter.toLowerCase()))
 const bySchool:Record<string,number>=subs.reduce((acc:Record<string,number>,s)=>{const key=s.school?.school_name||'All Section X';acc[key]=(acc[key]||0)+1;return acc},{})
 return <AdminLayout><div className="p-4 max-w-4xl mx-auto"><div className="flex items-center justify-between mb-2"><h1 className="text-2xl font-black text-white" style={{fontFamily:'var(--font-display)'}}>🔔 Score Alert Subscribers</h1><button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm"><Download size={14}/> Export CSV</button></div><p className="text-slate-400 text-sm mb-5">{subs.length} subscriber{subs.length!==1?'s':''} total</p>
 {error&&<div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
 {Object.keys(bySchool).length>0&&<div className="card p-4 mb-5"><p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3" style={{fontFamily:'var(--font-display)'}}>By School</p><div className="grid grid-cols-2 md:grid-cols-3 gap-2">{Object.entries(bySchool).sort((a,b)=>b[1]-a[1]).map(([school,count])=><div key={school} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{background:'rgba(255,255,255,0.04)'}}><span className="text-xs text-slate-300 truncate">{school}</span><span className="text-xs font-black text-white ml-2">{count}</span></div>)}</div></div>}
 <input className="input w-full mb-4" placeholder="Filter by email or school..." value={filter} onChange={e=>setFilter(e.target.value)}/>
 {loading?<div className="text-center py-8 text-slate-500">Loading...</div>:<div className="space-y-1">{filtered.length===0&&<div className="card p-8 text-center text-slate-500">No subscribers yet.</div>}{filtered.map(s=><div key={s.id} className="card p-3 flex items-center gap-3"><div className="flex-1 min-w-0"><p className="text-sm text-white font-mono">{s.email}</p><p className="text-xs text-slate-500">{s.school?.school_name||'All Section X'} · {new Date(s.created_at).toLocaleDateString()}</p></div><button onClick={()=>deleteSub(s.id)} className="text-xs text-slate-600 hover:text-red-400 px-2 py-1">Remove</button></div>)}</div>}</div></AdminLayout>
}
