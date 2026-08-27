import { createAdminClient } from '@/lib/supabase/server'
import ContributorAdmin from './ContributorAdmin'

export const revalidate = 0

export default async function ContributorsAdminPage() {
  const db = createAdminClient()
  const today = new Date().toISOString().slice(0,10)
  const future = new Date(Date.now()+1000*60*60*24*30).toISOString().slice(0,10)

  const [{ data: profiles }, { data: games }, { data: pendingUpdates }, { data: assignments }] = await Promise.all([
    db.from('contributor_profiles').select('*,school:schools(id,school_name)').order('created_at',{ascending:false}),
    db.from('games').select(`id,game_date,game_time,status,home_team:teams!games_home_team_id_fkey(team_name),away_team:teams!games_away_team_id_fkey(team_name),sport:sports(sport_name,gender)`).gte('game_date',today).lte('game_date',future).order('game_date').order('game_time').limit(400),
    db.from('contributor_score_updates').select(`id,contributor_id,game_id,home_score,away_score,game_status,note,publication_status,created_at,contributor:contributor_profiles(display_name,public_credit_name),game:games(game_date,home_team:teams!games_home_team_id_fkey(team_name),away_team:teams!games_away_team_id_fkey(team_name),sport:sports(sport_name,gender))`).eq('publication_status','pending').order('created_at',{ascending:false}).limit(100),
    db.from('contributor_game_assignments').select('id,contributor_id,game_id,assignment_role,active,created_at').eq('active',true),
  ])

  return <ContributorAdmin profiles={profiles||[]} games={games||[]} pendingUpdates={pendingUpdates||[]} assignments={assignments||[]} />
}
