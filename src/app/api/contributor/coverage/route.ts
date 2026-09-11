import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getContributorUser } from '@/lib/contributorAuth'

export const dynamic = 'force-dynamic'

function allowed(profile: any, role: string) {
  if (role === 'photographer') return Boolean(profile.can_submit_photos)
  if (role === 'score-reporter') return Boolean(profile.can_submit_scores)
  if (role === 'live-score') return Boolean(profile.can_live_score)
  return Boolean(profile.can_submit_photos || profile.can_submit_scores)
}

function getDb() {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

async function getApprovedProfile(db: any, userId: string) {
  return db.prepare('SELECT * FROM contributor_profiles WHERE user_id=? LIMIT 1').bind(userId).first()
}

export async function GET(req: NextRequest) {
  try {
    const user = await getContributorUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

    const db = getDb()
    const profile: any = await getApprovedProfile(db, user.id)
    if (!profile || profile.status !== 'approved') {
      return NextResponse.json({ error: 'Approved contributor account required.' }, { status: 403 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10)
    const result = await db.prepare(`
      SELECT
        cr.id, cr.game_id, cr.coverage_role, cr.status, cr.notes, cr.created_at,
        g.id AS game__id, g.game_date AS game__date, g.game_time AS game__time, g.status AS game__status,
        ht.team_name AS home__name, at.team_name AS away__name,
        sp.sport_name AS sport__name, sp.gender AS sport__gender
      FROM contributor_coverage_requests cr
      JOIN games g ON g.id=cr.game_id
      LEFT JOIN teams ht ON ht.id=g.home_team_id
      LEFT JOIN teams at ON at.id=g.away_team_id
      LEFT JOIN sports sp ON sp.id=g.sport_id
      WHERE cr.status='open' AND g.game_date>=? AND g.game_date<=?
      ORDER BY cr.created_at DESC
    `).bind(today, future).all()

    const requests = (result.results || [])
      .filter((r: any) => allowed(profile, r.coverage_role))
      .map((r: any) => ({
        id: r.id,
        game_id: r.game_id,
        coverage_role: r.coverage_role,
        status: r.status,
        notes: r.notes,
        created_at: r.created_at,
        game: {
          id: r.game__id,
          game_date: r.game__date,
          game_time: r.game__time,
          status: r.game__status,
          home_team: r.home__name ? { team_name: r.home__name } : null,
          away_team: r.away__name ? { team_name: r.away__name } : null,
          sport: r.sport__name ? { sport_name: r.sport__name, gender: r.sport__gender } : null,
        },
      }))

    return NextResponse.json({ ok: true, requests })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load coverage opportunities.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getContributorUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

    const body = await req.json()
    const requestId = String(body?.requestId || '')
    if (!requestId) return NextResponse.json({ error: 'Coverage request is required.' }, { status: 400 })

    const db = getDb()
    const profile: any = await getApprovedProfile(db, user.id)
    if (!profile || profile.status !== 'approved') {
      return NextResponse.json({ error: 'Approved contributor account required.' }, { status: 403 })
    }

    const requestRow: any = await db.prepare(
      'SELECT id,game_id,coverage_role,status FROM contributor_coverage_requests WHERE id=? LIMIT 1'
    ).bind(requestId).first()
    if (!requestRow) return NextResponse.json({ error: 'Coverage request not found.' }, { status: 404 })
    if (requestRow.status !== 'open') return NextResponse.json({ error: 'That coverage opportunity is no longer open.' }, { status: 409 })
    if (!allowed(profile, requestRow.coverage_role)) {
      return NextResponse.json({ error: 'Your contributor permissions do not allow this coverage role.' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const claim = await db.prepare(`
      UPDATE contributor_coverage_requests
      SET status='claimed', claimed_by=?, claimed_at=?, updated_at=?
      WHERE id=? AND status='open'
    `).bind(profile.id, now, now, requestId).run()

    if (Number(claim.meta?.changes || 0) !== 1) {
      return NextResponse.json({ error: 'Another contributor claimed this game first.' }, { status: 409 })
    }

    try {
      await db.prepare(`
        INSERT INTO contributor_game_assignments (id,contributor_id,game_id,assignment_role,active,created_at)
        VALUES (?,?,?,?,1,?)
        ON CONFLICT(contributor_id,game_id,assignment_role)
        DO UPDATE SET active=1
      `).bind(crypto.randomUUID(), profile.id, requestRow.game_id, requestRow.coverage_role, now).run()
    } catch (error) {
      await db.prepare(`
        UPDATE contributor_coverage_requests
        SET status='open',claimed_by=NULL,claimed_at=NULL,updated_at=?
        WHERE id=? AND claimed_by=?
      `).bind(new Date().toISOString(), requestId, profile.id).run()
      throw error
    }

    await db.batch([
      db.prepare(`
        INSERT INTO contributor_activity (id,contributor_id,event_type,entity_type,entity_id,details,created_at)
        VALUES (?,?,?,?,?,?,?)
      `).bind(
        crypto.randomUUID(), profile.id, 'coverage-claimed', 'game', requestRow.game_id,
        JSON.stringify({ coverageRequestId: requestId, role: requestRow.coverage_role }), now
      ),
      db.prepare('UPDATE contributor_profiles SET last_active_at=?,updated_at=? WHERE id=?').bind(now, now, profile.id),
    ])

    return NextResponse.json({ ok: true, claimed: true, gameId: requestRow.game_id, role: requestRow.coverage_role })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not claim coverage.' }, { status: 500 })
  }
}
