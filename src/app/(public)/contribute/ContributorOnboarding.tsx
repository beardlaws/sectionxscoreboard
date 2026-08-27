'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ContributorOnboarding({ schools }: { schools: { id: string; school_name: string }[] }) {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [mode, setMode] = useState<'login'|'signup'>('signup')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [auth, setAuth] = useState({ email: '', password: '', displayName: '' })
  const [application, setApplication] = useState({ publicCreditName: '', schoolId: '', bio: '', roles: ['photographer','score-reporter'] as string[] })

  async function refresh() {
    setLoading(true)
    const { data: { user: current } } = await supabase.auth.getUser()
    setUser(current || null)
    if (current) {
      const { data } = await supabase.from('contributor_profiles').select('*').eq('user_id', current.id).maybeSingle()
      setProfile(data || null)
      if (!data) {
        setApplication(a => ({ ...a, publicCreditName: current.user_metadata?.display_name || '' }))
      }
    } else {
      setProfile(null)
    }
    setLoading(false)
  }

  useEffect(() => { void refresh() }, [])

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault(); setWorking(true); setError(''); setMessage('')
    try {
      if (mode === 'signup') {
        if (!auth.displayName.trim()) throw new Error('Enter your name.')
        const { data, error } = await supabase.auth.signUp({
          email: auth.email.trim(),
          password: auth.password,
          options: { data: { display_name: auth.displayName.trim() } },
        })
        if (error) throw error
        if (!data.session) setMessage('Account created. Check your email to confirm it, then come back and sign in to finish your contributor application.')
        else await refresh()
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: auth.email.trim(), password: auth.password })
        if (error) throw error
        await refresh()
      }
    } catch (e: any) { setError(e.message || 'Could not continue.') }
    finally { setWorking(false) }
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault(); if (!user) return
    setWorking(true); setError(''); setMessage('')
    try {
      if (!application.publicCreditName.trim()) throw new Error('Enter the name you want shown publicly for photo/reporting credit.')
      if (!application.roles.length) throw new Error('Choose at least one way you want to contribute.')
      const { error } = await supabase.from('contributor_profiles').insert({
        user_id: user.id,
        display_name: user.user_metadata?.display_name || application.publicCreditName.trim(),
        public_credit_name: application.publicCreditName.trim(),
        email: user.email || null,
        school_id: application.schoolId || null,
        bio: application.bio.trim() || null,
        status: 'pending',
        roles: application.roles,
        trust_level: 'new',
        can_live_score: false,
        can_publish_photos: false,
      })
      if (error) throw error
      await refresh()
      setMessage('Application submitted. An admin will review it before any contributor privileges are activated.')
    } catch (e: any) { setError(e.message || 'Could not submit application.') }
    finally { setWorking(false) }
  }

  async function signOut() { await supabase.auth.signOut(); await refresh() }
  function toggleRole(role: string) { setApplication(a => ({ ...a, roles: a.roles.includes(role) ? a.roles.filter(x => x !== role) : [...a.roles, role] })) }

  if (loading) return <div className="card p-8 text-slate-400">Checking contributor account…</div>

  if (!user) return (
    <div className="card p-5 md:p-6 space-y-5">
      <div className="flex gap-2">
        <button onClick={() => setMode('signup')} className={`px-4 py-2 rounded-lg text-sm font-bold ${mode==='signup'?'bg-blue-600 text-white':'bg-white/5 text-slate-400'}`}>Create Account</button>
        <button onClick={() => setMode('login')} className={`px-4 py-2 rounded-lg text-sm font-bold ${mode==='login'?'bg-blue-600 text-white':'bg-white/5 text-slate-400'}`}>Sign In</button>
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-300 text-sm">{message}</div>}
      <form onSubmit={submitAuth} className="space-y-4">
        {mode === 'signup' && <div><label className="label">Your Name</label><input className="input" value={auth.displayName} onChange={e=>setAuth(a=>({...a,displayName:e.target.value}))} required /></div>}
        <div><label className="label">Email</label><input className="input" type="email" value={auth.email} onChange={e=>setAuth(a=>({...a,email:e.target.value}))} required /></div>
        <div><label className="label">Password</label><input className="input" type="password" minLength={8} value={auth.password} onChange={e=>setAuth(a=>({...a,password:e.target.value}))} required /></div>
        <button className="btn-primary w-full py-3" disabled={working}>{working?'Working…':mode==='signup'?'Create Contributor Account':'Sign In'}</button>
      </form>
    </div>
  )

  if (profile) {
    const approved = profile.status === 'approved'
    return (
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div><div className="text-xs uppercase tracking-widest text-slate-500">Contributor account</div><h2 className="text-2xl font-black text-white mt-1">{profile.public_credit_name || profile.display_name}</h2></div>
          <span className={`text-xs font-black uppercase rounded-full px-3 py-1 ${approved?'bg-emerald-500/10 text-emerald-300':profile.status==='suspended'?'bg-red-500/10 text-red-300':'bg-amber-500/10 text-amber-300'}`}>{profile.status}</span>
        </div>
        <p className="text-sm text-slate-400">{approved ? 'Your contributor account is active. Permissions are controlled by the Section X admin and every game-day action is logged.' : 'Your application is waiting for admin review. You can still use the normal public submission forms while you wait.'}</p>
        <div className="flex flex-wrap gap-2">{(profile.roles||[]).map((r:string)=><span key={r} className="text-xs px-2 py-1 rounded bg-white/5 text-slate-300">{r.replace(/-/g,' ')}</span>)}</div>
        <div className="flex flex-col sm:flex-row gap-2">
          {approved && <Link href="/contributor" className="btn-primary flex-1 text-center py-3">Open Contributor Dashboard</Link>}
          <button onClick={signOut} className="admin-action-btn justify-center">Sign Out</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={apply} className="card p-5 md:p-6 space-y-5">
      <div><h2 className="text-xl font-black text-white">Contributor Application</h2><p className="text-sm text-slate-500 mt-1">Your account is created. Tell us how you want to help.</p></div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-sm">{error}</div>}
      <div><label className="label">Public credit name *</label><input className="input" value={application.publicCreditName} onChange={e=>setApplication(a=>({...a,publicCreditName:e.target.value}))} required /></div>
      <div><label className="label">Home school / area</label><select className="input" value={application.schoolId} onChange={e=>setApplication(a=>({...a,schoolId:e.target.value}))}><option value="">No specific school</option>{schools.map(s=><option key={s.id} value={s.id}>{s.school_name}</option>)}</select></div>
      <div><label className="label">I want to help with</label><div className="grid sm:grid-cols-3 gap-2">{[['photographer','Photos'],['score-reporter','Scores'],['game-coverage','Game Coverage']].map(([id,label])=><button type="button" key={id} onClick={()=>toggleRole(id)} className={`rounded-xl border p-3 text-sm font-bold ${application.roles.includes(id)?'border-blue-500 bg-blue-500/10 text-blue-200':'border-white/10 bg-white/[0.02] text-slate-400'}`}>{application.roles.includes(id)?'✓ ':''}{label}</button>)}</div></div>
      <div><label className="label">About you</label><textarea className="input" rows={3} value={application.bio} onChange={e=>setApplication(a=>({...a,bio:e.target.value}))} placeholder="Optional: where you usually attend games, photography experience, teams you follow, etc." /></div>
      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-500">Applying does not grant live scoreboard access. Every contributor is reviewed by an admin, and higher-trust permissions are granted separately.</div>
      <button className="btn-primary w-full py-3" disabled={working}>{working?'Submitting…':'Submit Application for Review'}</button>
    </form>
  )
}
