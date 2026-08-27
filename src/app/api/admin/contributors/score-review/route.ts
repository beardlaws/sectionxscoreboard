import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const id = String(body?.updateId || '')
  const action = String(body?.action || '')
  if (!id || !['approve','reject'].includes(action)) return NextResponse.json({ error: 'updateId and valid action required.' }, { status: 400 })

  const db = createAdminClient()
  const { data: update, error } = await db.from('contributor_score_updates').select('*').eq('id', id).maybeSingle()
  if (error || !update) return NextResponse.json({ error: 'Contributor update not found.' }, { status: 404 })
  if (update.publication_status !== 'pending') return NextResponse.json({ error: `Update is already ${update.publication_status}.` }, { status: 409 })

  if (action === 'reject') {
    await db.from('contributor_score_updates').update({ publication_status: 'rejected', reviewed_by: 'admin', reviewed_at: new Date().toISOString() }).eq('id', id)
    const { data: p } = await db.from('contributor_profiles').select('rejected_count').eq('id', update.contributor_id).maybeSingle()
    await Promise.all([
      db.from('contributor_profiles').update({ rejected_count: Number(p?.rejected_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', update.contributor_id),
      db.from('contributor_activity').insert({ contributor_id: update.contributor_id, event_type: 'score-rejected', entity_type: 'game', entity_id: update.game_id, details: { updateId: id } }),
    ])
    return NextResponse.json({ ok: true, action: 'rejected' })
  }

  const { data: game, error: gameError } = await db.from('games').select('id,status,home_score,away_score,source,verification_status').eq('id', update.game_id).maybeSingle()
  if (gameError || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })
  const { error: writeError } = await db.from('games').update({
    home_score: update.home_score,
    away_score: update.away_score,
    status: update.game_status || game.status || 'Final',
    source: 'contributor',
    verification_status: 'Reported',
  }).eq('id', update.game_id)
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 })

  await db.from('contributor_score_updates').update({ publication_status: 'published', reviewed_by: 'admin', reviewed_at: new Date().toISOString() }).eq('id', id)
  const { data: p } = await db.from('contributor_profiles').select('verified_count').eq('id', update.contributor_id).maybeSingle()
  await Promise.all([
    db.from('contributor_profiles').update({ verified_count: Number(p?.verified_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', update.contributor_id),
    db.from('contributor_activity').insert({ contributor_id: update.contributor_id, event_type: 'score-approved', entity_type: 'game', entity_id: update.game_id, details: { updateId: id, before: game, after: { home_score: update.home_score, away_score: update.away_score, status: update.game_status } } }),
  ])
  return NextResponse.json({ ok: true, action: 'published' })
}
