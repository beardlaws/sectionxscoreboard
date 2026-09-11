import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

const score = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : null
}

function getDb() {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const gameId = String(body?.game_id || '')
    const homeScore = score(body?.home_score)
    const awayScore = score(body?.away_score)

    if (!gameId || homeScore === null || awayScore === null) {
      return NextResponse.json({ ok: false, error: 'Game and both non-negative scores are required.' }, { status: 400 })
    }

    const db = getDb()
    const current: any = await db.prepare('SELECT id,contest_type FROM games WHERE id=? LIMIT 1').bind(gameId).first()
    if (!current) return NextResponse.json({ ok: false, error: 'Game not found.' }, { status: 404 })

    if (String(current.contest_type || 'Game').toLowerCase() === 'scrimmage') {
      return NextResponse.json({ ok: false, error: 'Scrimmage scores are not published as official finals.' }, { status: 409 })
    }

    await db.prepare(`UPDATE games SET home_score=?,away_score=?,status='Final',verification_status='Reported',source='manual',updated_at=? WHERE id=?`)
      .bind(homeScore, awayScore, new Date().toISOString(), gameId)
      .run()

    return NextResponse.json({ ok: true, game_id: gameId, home_score: homeScore, away_score: awayScore, status: 'Final', source: 'manual' })
  } catch (error) {
    console.error('[quick-score]', error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not save score.' }, { status: 500 })
  }
}
