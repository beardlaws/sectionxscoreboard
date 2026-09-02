import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const score = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const gameId = String(body?.game_id || '')
  const homeScore = score(body?.home_score)
  const awayScore = score(body?.away_score)

  if (!gameId || homeScore === null || awayScore === null) {
    return NextResponse.json({ ok: false, error: 'Game and both non-negative scores are required.' }, { status: 400 })
  }

  const supabase = db()
  const { data: current, error: readError } = await supabase
    .from('games')
    .select('id,contest_type')
    .eq('id', gameId)
    .maybeSingle()

  if (readError || !current) {
    return NextResponse.json({ ok: false, error: readError?.message || 'Game not found.' }, { status: 404 })
  }

  if (String(current.contest_type || 'Game').toLowerCase() === 'scrimmage') {
    return NextResponse.json({ ok: false, error: 'Scrimmage scores are not published as official finals.' }, { status: 409 })
  }

  const { error } = await supabase
    .from('games')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: 'Final',
      verification_status: 'Reported',
      source: 'manual',
      updated_at: new Date().toISOString(),
    })
    .eq('id', gameId)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, game_id: gameId, home_score: homeScore, away_score: awayScore, status: 'Final', source: 'manual' })
}
