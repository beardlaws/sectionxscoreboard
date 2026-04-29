import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function checkAuth(req: NextRequest) {
  return req.cookies.get('admin_auth')?.value === 'SectionXScoreboardTheRightWay!'
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = getAdminClient()

  // Accept array (bulk import) or single object (manual entry)
  const games = Array.isArray(body) ? body : [body]
  const results: { action: string; error?: string }[] = []

  for (const game of games) {
    // Strip undefined values so insert doesn't fail on missing columns
    const clean: Record<string, any> = {}
    for (const [k, v] of Object.entries(game)) {
      if (v !== undefined) clean[k] = v
    }

    // Duplicate check when we have both teams + date + sport
    if (clean.home_team_id && clean.away_team_id && clean.game_date && clean.sport_id) {
      const { data: existing } = await supabase
        .from('games')
        .select('id')
        .eq('game_date', clean.game_date)
        .eq('sport_id', clean.sport_id)
        .eq('home_team_id', clean.home_team_id)
        .eq('away_team_id', clean.away_team_id)
        .limit(1)

      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('games')
          .update({
            home_score: clean.home_score ?? null,
            away_score: clean.away_score ?? null,
            status: clean.status ?? 'Final',
          })
          .eq('id', existing[0].id)
        results.push({ action: 'updated', error: error?.message })
        continue
      }
    }

    const { error } = await supabase.from('games').insert(clean)
    if (error) console.error('Insert error:', error.message, clean)
    results.push({ action: 'inserted', error: error?.message })
  }

  const errors = results.filter(r => r.error)
  return NextResponse.json({
    published: results.filter(r => !r.error).length,
    skipped: errors.length,
    errors: errors.map(e => e.error),
  })
}
