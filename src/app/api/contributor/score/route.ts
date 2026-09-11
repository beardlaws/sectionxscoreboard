import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getContributorUser } from '@/lib/contributorAuth'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS = new Set(['Scheduled', 'Live', 'Final', 'Halftime', 'Postponed', 'Canceled'])
const score = (value: any) => Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null

function getDb() {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

export async function POST(req: NextRequest) {
  try {
    const user = await getContributorUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

    const body = await req.json()
    const gameId = String(body?.gameId || '')
    const homeScore = score(body?.homeScore)
    const awayScore = score(body?.awayScore)
    const requestedStatus = String(body?.status || 'Live')
    const updateType = requestedStatus === 'Final' ? 'final' : 'score'

    if (!gameId || homeScore === null || awayScore === null) {
      return NextResponse.json({ error: 'Valid game and non-negative scores are required.' }, { status: 400 })
    }
    if (!ALLOWED_STATUS.has(requestedStatus)) {
      return NextResponse.json({ error: 'Invalid game status.' }, { status: 400 })
    }

    const db = getDb()
    const profile: any = await db.prepare(
      'SELECT * FROM contributor_profiles WHERE user_id=? LIMIT 1'
    ).bind(user.id).first()
    if (!profile || profile.status !== 'approved' || !profile.can_submit_scores) {
      return NextResponse.json({ error: 'Your contributor account is not approved for score reporting.' }, { status: 403 })
    }

    const game: any = await db.prepare(`
      SELECT id,home_score,away_score,status,source,verification_status,game_date,home_team_id,away_team_id
      FROM games WHERE id=? LIMIT 1
    `).bind(gameId).first()
    if (!game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })

    const assignment: any = await db.prepare(`
      SELECT id,assignment_role FROM contributor_game_assignments
      WHERE contributor_id=? AND game_id=? AND active=1 LIMIT 1
    `).bind(profile.id, gameId).first()

    const protectedFinal = String(game.status || '').toLowerCase() === 'final'
      && Boolean(game.source)
      && !String(game.source).startsWith('contributor')
    const canPublish = Boolean(profile.can_live_score && assignment && !protectedFinal)
    const before = {
      home_score: game.home_score,
      away_score: game.away_score,
      status: game.status,
      source: game.source,
      verification_status: game.verification_status,
    }
    const after = { home_score: homeScore, away_score: awayScore, status: requestedStatus }
    const now = new Date().toISOString()
    const updateId = crypto.randomUUID()

    await db.prepare(`
      INSERT INTO contributor_score_updates (
        id,contributor_id,game_id,home_score,away_score,game_status,note,update_type,
        publication_status,before_state,after_state,reviewed_by,reviewed_at,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      updateId,
      profile.id,
      gameId,
      homeScore,
      awayScore,
      requestedStatus,
      body?.note ? String(body.note).slice(0, 500) : null,
      updateType,
      canPublish ? 'published' : 'pending',
      JSON.stringify(before),
      JSON.stringify(after),
      canPublish ? 'trusted-contributor-auto' : null,
      canPublish ? now : null,
      now,
    ).run()

    if (canPublish) {
      try {
        await db.prepare(`
          UPDATE games
          SET home_score=?,away_score=?,status=?,source='contributor',verification_status=?,updated_at=?
          WHERE id=?
        `).bind(
          homeScore,
          awayScore,
          requestedStatus,
          requestedStatus === 'Final' ? 'Reported' : (game.verification_status || 'Reported'),
          now,
          gameId,
        ).run()
      } catch (error) {
        await db.prepare(`
          UPDATE contributor_score_updates
          SET publication_status='pending',reviewed_by=NULL,reviewed_at=NULL
          WHERE id=?
        `).bind(updateId).run()
        throw error
      }
    }

    await db.batch([
      db.prepare(`
        INSERT INTO contributor_activity (id,contributor_id,event_type,entity_type,entity_id,details,created_at)
        VALUES (?,?,?,?,?,?,?)
      `).bind(
        crypto.randomUUID(),
        profile.id,
        canPublish ? 'score-published' : 'score-submitted',
        'game',
        gameId,
        JSON.stringify({ updateId, before, after, assignment: assignment?.assignment_role || null }),
        now,
      ),
      db.prepare(`
        UPDATE contributor_profiles
        SET submissions_count=COALESCE(submissions_count,0)+1,last_active_at=?,updated_at=?
        WHERE id=?
      `).bind(now, now, profile.id),
    ])

    return NextResponse.json({
      ok: true,
      published: canPublish,
      pendingReview: !canPublish,
      protectedFinal,
      updateId,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not submit score update.' }, { status: 500 })
  }
}
