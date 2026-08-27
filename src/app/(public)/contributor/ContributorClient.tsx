'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ContributorDashboard from './ContributorDashboard'

export default function ContributorClient() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [signedIn, setSignedIn] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) {
        setSignedIn(false)
        setProfile(null)
        return
      }
      setSignedIn(true)

      const { data: p, error: profileError } = await supabase
        .from('contributor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profileError) throw profileError
      setProfile(p || null)
      if (!p) return

      const [{ data: a, error: assignmentError }, { data: r, error: recentError }] = await Promise.all([
        supabase
          .from('contributor_game_assignments')
          .select(`id,assignment_role,notes,active,game:games(id,game_date,game_time,status,home_score,away_score,home_team:teams!games_home_team_id_fkey(team_name),away_team:teams!games_away_team_id_fkey(team_name),sport:sports(sport_name,gender))`)
          .eq('contributor_id', p.id)
          .eq('active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('contributor_score_updates')
          .select('id,game_id,home_score,away_score,game_status,publication_status,created_at')
          .eq('contributor_id', p.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      if (assignmentError) throw assignmentError
      if (recentError) throw recentError
      setAssignments(a || [])
      setRecent(r || [])
    } catch (e: any) {
      setError(e.message || 'Could not load contributor dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (loading) return <main className="max-w-4xl mx-auto px-4 py-10"><div className="card p-8 text-slate-400">Loading contributor dashboard…</div></main>

  if (error) return <main className="max-w-4xl mx-auto px-4 py-10"><div className="card p-8 space-y-4"><h1 className="text-2xl font-black text-white">Contributor dashboard could not load</h1><p className="text-red-300 text-sm">{error}</p><button onClick={load} className="btn-primary px-5 py-3">Try Again</button></div></main>

  if (!signedIn || !profile) return <main className="max-w-4xl mx-auto px-4 py-10"><div className="card p-8 text-center space-y-4"><h1 className="text-3xl font-black text-white">Contributor Sign In Required</h1><p className="text-slate-400">Sign in to your contributor account to open the game-day dashboard.</p><Link href="/contribute" className="btn-primary inline-block px-5 py-3">Go to Contributor Sign In</Link></div></main>

  if (profile.status !== 'approved') return <main className="max-w-4xl mx-auto px-4 py-10"><div className="card p-8 text-center space-y-4"><div className="text-xs uppercase tracking-widest text-amber-300">Contributor Status</div><h1 className="text-3xl font-black text-white">{profile.status === 'pending' ? 'Application Under Review' : `Account ${profile.status}`}</h1><p className="text-slate-400">Contributor tools stay locked until an admin approves your account.</p><Link href="/contribute" className="btn-primary inline-block px-5 py-3">View Account</Link></div></main>

  return <ContributorDashboard profile={profile} assignments={assignments} recent={recent} />
}
