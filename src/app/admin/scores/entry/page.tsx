// src/app/admin/scores/entry/page.tsx
import { getCloudflareContext } from '@opennextjs/cloudflare'
import AdminLayout from '@/components/layout/AdminLayout'
import ScoreEntryForm from './ScoreEntryForm'

export const dynamic = 'force-dynamic'

export default async function ScoreEntryPage() {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

  const [sportsResult, teamsResult, seasonsResult] = await Promise.all([
    db.prepare('SELECT * FROM sports WHERE active_public=1 ORDER BY sport_name').all(),
    db.prepare(`
      SELECT t.*,s.school_name,s.alias
      FROM teams t
      LEFT JOIN schools s ON s.id=t.school_id
      WHERE t.active=1
      ORDER BY t.team_name
    `).all(),
    db.prepare('SELECT * FROM seasons ORDER BY year DESC').all(),
  ])

  const sports = (sportsResult.results || []).map((s:any)=>({ ...s, active_public:Boolean(s.active_public) }))
  const teams = (teamsResult.results || []).map((t:any)=>({
    ...t,
    active:Boolean(t.active),
    school:t.school_id ? { school_name:t.school_name, alias:t.alias } : null,
  }))
  const seasons = (seasonsResult.results || []).map((s:any)=>({ ...s, is_active:Boolean(s.is_active) }))

  return (
    <AdminLayout>
      <div className="p-4 max-w-2xl">
        <h1 className="text-2xl font-bold mb-5" style={{ fontFamily: 'var(--font-display)' }}>Enter Score</h1>
        <ScoreEntryForm sports={sports as any[]} teams={teams as any[]} seasons={seasons as any[]} />
      </div>
    </AdminLayout>
  )
}
