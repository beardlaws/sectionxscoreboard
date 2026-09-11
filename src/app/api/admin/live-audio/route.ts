import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

function db() {
  const { env } = getCloudflareContext()
  const database = (env as any).DB
  if (!database) throw new Error('Cloudflare D1 binding DB is unavailable')
  return database
}

function teamName(row: any, side: 'home' | 'away') {
  return row[`${side}_school_name`] || row[`${side}_team_name`] || row[`${side}_external_name`] || (side === 'home' ? 'Home' : 'Away')
}

export async function GET() {
  try {
    const database = db()
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date(Date.now() + 45 * 86400_000).toISOString().slice(0, 10)

    const [gamesRaw, contributorsRaw, broadcastsRaw] = await Promise.all([
      database.prepare(`
        SELECT g.id,g.game_date,g.game_time,g.status,
          sp.sport_name,sp.gender,
          ht.team_name AS home_team_name,hs.school_name AS home_school_name,eh.name AS home_external_name,
          at.team_name AS away_team_name,aschool.school_name AS away_school_name,ea.name AS away_external_name
        FROM games g
        LEFT JOIN sports sp ON sp.id=g.sport_id
        LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN schools hs ON hs.id=ht.school_id
        LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN schools aschool ON aschool.id=at.school_id
        LEFT JOIN external_opponents eh ON eh.id=g.external_home_opponent_id
        LEFT JOIN external_opponents ea ON ea.id=g.external_away_opponent_id
        WHERE g.game_date>=? AND g.game_date<=? AND lower(COALESCE(g.status,'')) NOT IN ('canceled','cancelled','postponed','ppd')
        ORDER BY g.game_date,g.game_time
      `).bind(today, future).all(),
      database.prepare(`
        SELECT p.id,p.user_id,p.public_credit_name,p.display_name,p.email,p.roles
        FROM contributor_profiles p
        WHERE p.status='approved' AND p.user_id IS NOT NULL
        ORDER BY COALESCE(p.public_credit_name,p.display_name,p.email)
      `).all(),
      database.prepare(`
        SELECT b.*,
          sp.sport_name,sp.gender,
          ht.team_name AS home_team_name,hs.school_name AS home_school_name,eh.name AS home_external_name,
          at.team_name AS away_team_name,aschool.school_name AS away_school_name,ea.name AS away_external_name,
          GROUP_CONCAT(CASE WHEN ba.active=1 THEN COALESCE(ba.display_name,ba.subject_id)||' ['||ba.role||']' END, ', ') AS assignments
        FROM broadcasts b
        JOIN games g ON g.id=b.game_id
        LEFT JOIN sports sp ON sp.id=g.sport_id
        LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN schools hs ON hs.id=ht.school_id
        LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN schools aschool ON aschool.id=at.school_id
        LEFT JOIN external_opponents eh ON eh.id=g.external_home_opponent_id
        LEFT JOIN external_opponents ea ON ea.id=g.external_away_opponent_id
        LEFT JOIN broadcast_assignments ba ON ba.broadcast_id=b.id
        WHERE g.game_date>=?
        GROUP BY b.id
        ORDER BY COALESCE(b.scheduled_at,b.created_at) ASC
      `).bind(today).all(),
    ])

    const games = (gamesRaw.results || []).map((row: any) => ({
      id: row.id,
      gameDate: row.game_date,
      gameTime: row.game_time,
      status: row.status,
      sport: row.sport_name,
      gender: row.gender,
      home: teamName(row, 'home'),
      away: teamName(row, 'away'),
      label: `${teamName(row, 'away')} at ${teamName(row, 'home')}`,
    }))

    const contributors = (contributorsRaw.results || []).map((row: any) => ({
      id: row.id,
      subjectId: row.user_id,
      name: row.public_credit_name || row.display_name || row.email,
      email: row.email,
      roles: row.roles,
    }))

    const broadcasts = (broadcastsRaw.results || []).map((row: any) => ({
      id: row.id,
      gameId: row.game_id,
      title: row.title,
      status: row.status,
      provider: row.provider,
      publicEnabled: Boolean(row.public_enabled),
      rightsStatus: row.rights_status,
      rightsHolder: row.rights_holder,
      rightsApprovedBy: row.rights_approved_by,
      rightsApprovedAt: row.rights_approved_at,
      rightsDocumentUrl: row.rights_document_url,
      rightsNotes: row.rights_notes,
      scheduledAt: row.scheduled_at,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      assignments: row.assignments || '',
      sport: row.sport_name,
      gender: row.gender,
      home: teamName(row, 'home'),
      away: teamName(row, 'away'),
    }))

    return NextResponse.json({ ok: true, games, contributors, broadcasts })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load live audio admin.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const database = db()
    const body = await req.json()
    const action = String(body?.action || '')
    const now = new Date().toISOString()

    if (action === 'create') {
      const gameId = String(body?.gameId || '')
      if (!gameId) return NextResponse.json({ error: 'Game is required.' }, { status: 400 })
      const game: any = await database.prepare(`
        SELECT g.id,g.game_date,g.game_time,
          ht.team_name AS home_team_name,hs.school_name AS home_school_name,eh.name AS home_external_name,
          at.team_name AS away_team_name,aschool.school_name AS away_school_name,ea.name AS away_external_name
        FROM games g
        LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN schools hs ON hs.id=ht.school_id
        LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN schools aschool ON aschool.id=at.school_id
        LEFT JOIN external_opponents eh ON eh.id=g.external_home_opponent_id
        LEFT JOIN external_opponents ea ON ea.id=g.external_away_opponent_id
        WHERE g.id=? LIMIT 1
      `).bind(gameId).first()
      if (!game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
      const existing = await database.prepare(`SELECT id FROM broadcasts WHERE game_id=? AND status NOT IN ('canceled') LIMIT 1`).bind(gameId).first()
      if (existing) return NextResponse.json({ error: 'A broadcast already exists for this game.' }, { status: 409 })

      const id = crypto.randomUUID()
      const title = String(body?.title || `${teamName(game, 'away')} at ${teamName(game, 'home')}`)
      const scheduledAt = game.game_date ? `${game.game_date}T${game.game_time || '00:00:00'}` : null
      await database.prepare(`
        INSERT INTO broadcasts
        (id,game_id,title,status,provider,public_enabled,rights_status,scheduled_at,created_by,created_at,updated_at)
        VALUES (?, ?, ?, 'scheduled', 'realtimekit', 0, 'pending', ?, 'admin', ?, ?)
      `).bind(id, gameId, title, scheduledAt, now, now).run()
      return NextResponse.json({ ok: true, id })
    }

    if (action === 'assign') {
      const broadcastId = String(body?.broadcastId || '')
      const subjectId = String(body?.subjectId || '')
      const role = String(body?.role || 'broadcaster')
      if (!broadcastId || !subjectId) return NextResponse.json({ error: 'Broadcast and contributor are required.' }, { status: 400 })
      if (!['producer','broadcaster','color','sideline','scorekeeper'].includes(role)) return NextResponse.json({ error: 'Invalid broadcast role.' }, { status: 400 })
      const profile: any = await database.prepare(`SELECT public_credit_name,display_name,email FROM contributor_profiles WHERE user_id=? AND status='approved' LIMIT 1`).bind(subjectId).first()
      if (!profile) return NextResponse.json({ error: 'Approved contributor not found.' }, { status: 404 })
      const displayName = profile.public_credit_name || profile.display_name || profile.email
      await database.prepare(`
        INSERT INTO broadcast_assignments (id,broadcast_id,subject_id,display_name,role,active,assigned_by,created_at)
        VALUES (?,?,?,?,?,1,'admin',?)
        ON CONFLICT(broadcast_id,subject_id,role) DO UPDATE SET active=1,display_name=excluded.display_name
      `).bind(crypto.randomUUID(), broadcastId, subjectId, displayName, role, now).run()
      return NextResponse.json({ ok: true })
    }

    if (action === 'rights') {
      const broadcastId = String(body?.broadcastId || '')
      const rightsStatus = String(body?.rightsStatus || '')
      if (!broadcastId || !['pending','approved','not_required','denied','expired'].includes(rightsStatus)) {
        return NextResponse.json({ error: 'Valid broadcast and rights status are required.' }, { status: 400 })
      }
      const approved = rightsStatus === 'approved' || rightsStatus === 'not_required'
      await database.prepare(`
        UPDATE broadcasts SET
          rights_status=?,rights_holder=?,rights_approved_by=?,rights_approved_at=?,rights_document_url=?,rights_notes=?
        WHERE id=?
      `).bind(
        rightsStatus,
        String(body?.rightsHolder || '').trim() || null,
        approved ? (String(body?.approvedBy || '').trim() || 'admin') : null,
        approved ? now : null,
        String(body?.documentUrl || '').trim() || null,
        String(body?.notes || '').trim() || null,
        broadcastId,
      ).run()
      return NextResponse.json({ ok: true })
    }

    if (action === 'cancel') {
      const broadcastId = String(body?.broadcastId || '')
      if (!broadcastId) return NextResponse.json({ error: 'Broadcast is required.' }, { status: 400 })
      await database.prepare(`UPDATE broadcasts SET status='canceled',public_enabled=0,ended_at=? WHERE id=?`).bind(now, broadcastId).run()
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown live audio admin action.' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Live audio admin action failed.' }, { status: 500 })
  }
}
