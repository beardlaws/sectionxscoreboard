import { getCloudflareContext } from '@opennextjs/cloudflare'
import AdminLayout from '@/components/layout/AdminLayout'
import GamesManager from './GamesManager'

export const dynamic = 'force-dynamic'

export default async function ManageGamesPage() {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

  const [sportsResult,seasonsResult,teamsResult] = await Promise.all([
    db.prepare('SELECT id,sport_name,gender,slug FROM sports ORDER BY sport_name').all(),
    db.prepare('SELECT * FROM seasons ORDER BY year DESC').all(),
    db.prepare(`
      SELECT t.id,t.team_name,t.sport_id,s.school_name
      FROM teams t LEFT JOIN schools s ON s.id=t.school_id
      ORDER BY t.team_name
    `).all(),
  ])

  const sports=sportsResult.results||[]
  const seasons=(seasonsResult.results||[]).map((s:any)=>({...s,is_active:Boolean(s.is_active)}))
  const teams=(teamsResult.results||[]).map((t:any)=>({
    id:t.id,
    team_name:t.team_name,
    sport_id:t.sport_id,
    school:t.school_name?{school_name:t.school_name}:null,
  }))

  return (
    <AdminLayout>
      <GamesManager sports={sports as any[]} seasons={seasons as any[]} teams={teams as any[]} />
    </AdminLayout>
  )
}
