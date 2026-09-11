'use client'

import { useEffect,useState } from 'react'
import Link from 'next/link'
import ContributorDashboard from './ContributorDashboard'

export default function ContributorClient(){
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[profile,setProfile]=useState<any>(null),[assignments,setAssignments]=useState<any[]>([]),[recent,setRecent]=useState<any[]>([]),[coverageRequests,setCoverageRequests]=useState<any[]>([]),[coverageWarning,setCoverageWarning]=useState(''),[signedIn,setSignedIn]=useState(false)
 async function load(){
  setLoading(true);setError('');setCoverageWarning('')
  try{
   const [dashboardResponse,coverageResponse]=await Promise.all([
    fetch('/api/contributor/dashboard',{cache:'no-store',credentials:'include'}),
    fetch('/api/contributor/coverage',{cache:'no-store',credentials:'include'}),
   ])
   const dashboard=await dashboardResponse.json().catch(()=>({}))
   if(!dashboardResponse.ok)throw new Error(dashboard?.error||'Could not load contributor dashboard.')
   setSignedIn(Boolean(dashboard.signedIn));setProfile(dashboard.profile||null);setAssignments(dashboard.assignments||[]);setRecent(dashboard.recent||[])
   if(coverageResponse.ok){const coverage=await coverageResponse.json().catch(()=>({}));setCoverageRequests(coverage.requests||[])}
   else if(dashboard.signedIn&&dashboard.profile?.status==='approved'){const coverage=await coverageResponse.json().catch(()=>({}));setCoverageWarning(coverage?.error||'Coverage opportunities are temporarily unavailable.');setCoverageRequests([])}
   else setCoverageRequests([])
  }catch(e:any){setError(e?.message||'Could not load contributor dashboard.')}finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 if(loading)return <main className="max-w-4xl mx-auto px-4 py-10"><div className="card p-8 text-slate-400">Loading contributor dashboard…</div></main>
 if(error)return <main className="max-w-4xl mx-auto px-4 py-10"><div className="card p-8 space-y-4"><h1 className="text-2xl font-black text-white">Contributor dashboard could not load</h1><p className="text-red-300 text-sm">{error}</p><button onClick={load} className="btn-primary px-5 py-3">Try Again</button></div></main>
 if(!signedIn||!profile)return <main className="max-w-4xl mx-auto px-4 py-10"><div className="card p-8 text-center space-y-4"><h1 className="text-3xl font-black text-white">Contributor Sign In Required</h1><p className="text-slate-400">Sign in to your contributor account to open the game-day dashboard.</p><Link href="/contribute" className="btn-primary inline-block px-5 py-3">Go to Contributor Sign In</Link></div></main>
 if(profile.status!=='approved')return <main className="max-w-4xl mx-auto px-4 py-10"><div className="card p-8 text-center space-y-4"><div className="text-xs uppercase tracking-widest text-amber-300">Contributor Status</div><h1 className="text-3xl font-black text-white">{profile.status==='pending'?'Application Under Review':`Account ${profile.status}`}</h1><p className="text-slate-400">Contributor tools stay locked until an admin approves your account.</p><Link href="/contribute" className="btn-primary inline-block px-5 py-3">View Account</Link></div></main>
 return <ContributorDashboard profile={profile} assignments={assignments} recent={recent} coverageRequests={coverageRequests} coverageWarning={coverageWarning}/>
}
