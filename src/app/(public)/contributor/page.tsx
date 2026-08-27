import { redirect } from 'next/navigation'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { createClient } from '@/lib/supabase/server'
import ContributorDashboard from './ContributorDashboard'

export const revalidate = 0

export default async function ContributorPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/contribute')

  const { data: profile } = await supabase.from('contributor_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (!profile) redirect('/contribute')

  if (profile.status !== 'approved') {
    return (
      <PublicLayout>
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="card p-8 text-center space-y-4">
            <div className="text-xs uppercase tracking-widest text-amber-300">Contributor Status</div>
            <h1 className="text-3xl font-black text-white">{profile.status === 'pending' ? 'Application Under Review' : `Account ${profile.status}`}</h1>
            <p className="text-slate-400">Live contributor tools stay locked until an admin approves your account.</p>
            <Link href="/contribute" className="btn-primary inline-block px-5 py-3">View Account</Link>
          </div>
        </main>
      </PublicLayout>
    )
  }

  const { data: assignments } = await supabase
    .from('contributor_game_assignments')
    .select(`id,assignment_role,notes,active,game:games(id,game_date,game_time,status,home_score,away_score,home_team:teams!games_home_team_id_fkey(team_name),away_team:teams!games_away_team_id_fkey(team_name),sport:sports(sport_name,gender))`)
    .eq('contributor_id', profile.id)
    .eq('active', true)
    .order('created_at', { ascending: false })

  const { data: recent } = await supabase
    .from('contributor_score_updates')
    .select('id,game_id,home_score,away_score,game_status,publication_status,created_at')
    .eq('contributor_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <PublicLayout>
      <ContributorDashboard profile={profile} assignments={assignments || []} recent={recent || []} />
    </PublicLayout>
  )
}
