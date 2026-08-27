import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getContributorUser } from '@/lib/contributorAuth'

const ALLOWED_STATUS = new Set(['Scheduled','Live','Final','Halftime','Postponed','Canceled'])
const score = (v:any) => Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : null

export async function POST(req: NextRequest) {
  const user = await getContributorUser(req)
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

  const body = await req.json()
  const gameId = String(body?.gameId || '')
  const homeScore = score(body?.homeScore)
  const awayScore = score(body?.awayScore)
  const requestedStatus = String(body?.status || 'Live')
  const updateType = requestedStatus === 'Final' ? 'final' : 'score'
  if (!gameId || homeScore === null || awayScore === null) return NextResponse.json({ error: 'Valid game and non-negative scores are required.' }, { status: 400 })
  if (!ALLOWED_STATUS.has(requestedStatus)) return NextResponse.json({ error: 'Invalid game status.' }, { status: 400 })

  const db = createAdminClient()
  const { data: profile } = await db.from('contributor_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (!profile || profile.status !== 'approved' || !profile.can_submit_scores) return NextResponse.json({ error: 'Your contributor account is not approved for score reporting.' }, { status: 403 })

  const { data: game, error: gameError } = await db.from('games').select('id,home_score,away_score,status,source,verification_status,game_date,home_team_id,away_team_id').eq('id', gameId).maybeSingle()
  if (gameError || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 })

  const { data: assignment } = await db.from('contributor_game_assignments').select('id,assignment_role').eq('contributor_id', profile.id).eq('game_id', gameId).eq('active', true).limit(1).maybeSingle()
  const protectedFinal = String(game.status || '').toLowerCase() === 'final' && game.source && !String(game.source).startsWith('contributor')
  const canPublish = Boolean(profile.can_live_score && assignment && !protectedFinal)
  const before = { home_score: game.home_score, away_score: game.away_score, status: game.status, source: game.source, verification_status: game.verification_status }
  const after = { home_score: homeScore, away_score: awayScore, status: requestedStatus }

  const { data: updateRow, error: insertError } = await db.from('contributor_score_updates').insert({
    contributor_id: profile.id,
    game_id: gameId,
    home_score: homeScore,
    away_score: awayScore,
    game_status: requestedStatus,
    note: body?.note ? String(body.note).slice(0,500) : null,
    update_type: updateType,
    publication_status: canPublish ? 'published' : 'pending',
    before_state: before,
    after_state: after,
    reviewed_by: canPublish ? 'trusted-contributor-auto' : null,
    reviewed_at: canPublish ? new Date().toISOString() : null,
  }).select('id').single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  if (canPublish) {
    const { error: writeError } = await db.from('games').update({
      home_score: homeScore,
      away_score: awayScore,
      status: requestedStatus,
      source: 'contributor',
      verification_status: requestedStatus === 'Final' ? 'Reported' : game.verification_status || 'Reported',
    }).eq('id', gameId)
    if (writeError) {
      await db.from('contributor_score_updates').update({ publication_status: 'pending', reviewed_by: null, reviewed_at: null }).eq('id', updateRow.id)
      return NextResponse.json({ error: writeError.message }, { status: 500 })
    }
  }

  await Promise.all([
    db.from('contributor_activity').insert({ contributor_id: profile.id, event_type: canPublish ? 'score-published' : 'score-submitted', entity_type: 'game', entity_id: gameId, details: { updateId: updateRow.id, before, after, assignment: assignment?.assignment_role || null } }),
    db.from('contributor_profiles').update({ submissions_count: Number(profile.submissions_count || 0) + 1, last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', profile.id),
  ])

  return NextResponse.json({ ok: true, published: canPublish, pendingReview: !canPublish, protectedFinal, updateId: updateRow.id })
}
