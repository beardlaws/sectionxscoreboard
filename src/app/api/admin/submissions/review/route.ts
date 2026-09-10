import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const submissionId = String(body?.submission_id || '').trim()
    const action = String(body?.action || '').trim()
    const gameId = body?.game_id ? String(body.game_id).trim() : null

    if (!submissionId || !['approve','reject'].includes(action)) {
      return NextResponse.json({ ok:false, error:'Invalid review request.' }, { status:400 })
    }

    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

    const submission:any = await db.prepare('SELECT * FROM submissions WHERE id=? LIMIT 1').bind(submissionId).first()
    if (!submission) return NextResponse.json({ ok:false, error:'Submission not found.' }, { status:404 })
    if (String(submission.status || '').toLowerCase() !== 'pending') {
      return NextResponse.json({ ok:false, error:'Submission has already been reviewed.' }, { status:409 })
    }

    if (action === 'reject') {
      await db.prepare("UPDATE submissions SET status='rejected', reviewed_by='admin' WHERE id=?").bind(submissionId).run()
      return NextResponse.json({ ok:true, action:'rejected' })
    }

    if (!gameId) return NextResponse.json({ ok:false, error:'A canonical game match is required.' }, { status:400 })
    const game:any = await db.prepare('SELECT id,status,home_score,away_score FROM games WHERE id=? LIMIT 1').bind(gameId).first()
    if (!game) return NextResponse.json({ ok:false, error:'Canonical game not found.' }, { status:404 })

    const submittedHome = body?.home_score == null ? null : Number(body.home_score)
    const submittedAway = body?.away_score == null ? null : Number(body.away_score)
    if (!Number.isInteger(submittedHome) || !Number.isInteger(submittedAway) || submittedHome < 0 || submittedAway < 0) {
      return NextResponse.json({ ok:false, error:'Valid canonical home and away scores are required.' }, { status:400 })
    }

    const existingFinal = String(game.status || '').toLowerCase() === 'final' && game.home_score != null && game.away_score != null
    const alreadyMatches = existingFinal && Number(game.home_score) === submittedHome && Number(game.away_score) === submittedAway
    if (existingFinal && !alreadyMatches) {
      return NextResponse.json({ ok:false, error:'Existing final conflicts with this submission. Use Manage Games for an official correction.' }, { status:409 })
    }

    const statements:any[] = []
    if (!alreadyMatches) {
      statements.push(db.prepare("UPDATE games SET home_score=?, away_score=?, status='Final', verification_status='Reported', updated_at=datetime('now') WHERE id=?").bind(submittedHome, submittedAway, gameId))
    }
    statements.push(db.prepare("UPDATE submissions SET status='approved', reviewed_by='admin' WHERE id=?").bind(submissionId))
    await db.batch(statements)

    return NextResponse.json({ ok:true, action:alreadyMatches?'closed-match':'applied', game_id:gameId })
  } catch (error:any) {
    console.error('[admin/submissions/review]', error)
    return NextResponse.json({ ok:false, error:error?.message || 'Could not review submission.' }, { status:500 })
  }
}
