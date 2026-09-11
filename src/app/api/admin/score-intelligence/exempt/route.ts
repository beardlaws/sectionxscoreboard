import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const REASONS = new Set([
  'no-team-score-published',
  'meet-result-unavailable',
  'event-wrapper',
  'abandoned-no-official-result',
  'other',
])

function getDb(){
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const gameId = String(body?.game_id || '')
    const exempt = Boolean(body?.exempt)
    const reason = exempt ? String(body?.reason || '') : ''

    if (!gameId) return NextResponse.json({ ok: false, error: 'Game is required.' }, { status: 400 })
    if (exempt && !REASONS.has(reason)) return NextResponse.json({ ok: false, error: 'Choose a valid exemption reason.' }, { status: 400 })

    const db = getDb()
    const game:any = await db.prepare('SELECT id,status,contest_type,home_score,away_score FROM games WHERE id=? LIMIT 1').bind(gameId).first()
    if (!game) return NextResponse.json({ ok: false, error: 'Game not found.' }, { status: 404 })
    if (String(game.contest_type || '').toLowerCase() === 'scrimmage') return NextResponse.json({ ok: false, error: 'Scrimmages are already excluded from score coverage.' }, { status: 409 })
    if (exempt && String(game.status || '').toLowerCase() === 'final' && game.home_score != null && game.away_score != null) return NextResponse.json({ ok: false, error: 'This game already has a final score and does not need an exemption.' }, { status: 409 })

    const updatedAt = new Date().toISOString()
    await db.prepare('UPDATE games SET result_exempt=?, result_exempt_reason=?, updated_at=? WHERE id=?')
      .bind(exempt?1:0, exempt?reason:null, updatedAt, gameId).run()

    return NextResponse.json({ ok: true, game_id: gameId, result_exempt: exempt, result_exempt_reason: exempt ? reason : null })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not update result exemption.' }, { status: 500 })
  }
}
