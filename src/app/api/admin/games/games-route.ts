import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function checkAuth() {
  const cookieStore = cookies()
  return cookieStore.get('admin_auth')?.value === 'SectionXScoreboardTheRightWay!'
}

export async function POST(req: NextRequest) {
  if (!checkAuth()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const supabase = getAdminClient()

  // Batch insert (array) or single insert (object)
  const games = Array.isArray(body) ? body : [body]
  const results = []

  for (const game of games) {
    // Duplicate check: same teams + date + sport
    if (game.home_team_id && game.away_team_id && game.game_date && game.sport_id) {
      const { data: existing } = await supabase
        .from('games')
        .select('id')
        .eq('game_date', game.game_date)
        .eq('sport_id', game.sport_id)
        .eq('home_team_id', game.home_team_id)
        .eq('away_team_id', game.away_team_id)
        .limit(1)

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('games')
          .update({
            home_score: game.home_score,
            away_score: game.away_score,
            status: game.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing[0].id)
        results.push({ action: 'updated', error: error?.message })
        continue
      }
    }

    const { error } = await supabase.from('games').insert(game)
    results.push({ action: 'inserted', error: error?.message })
  }

  const errors = results.filter(r => r.error)
  return NextResponse.json({
    published: results.filter(r => !r.error).length,
    skipped: errors.length,
    errors: errors.map(e => e.error),
  })
}
