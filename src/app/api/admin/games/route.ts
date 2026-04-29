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

async function findOrCreateExternalOpponent(supabase: any, name: string): Promise<string | null> {
  if (!name?.trim()) return null
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  
  // Try to find existing
  const { data: existing } = await supabase
    .from('external_opponents')
    .select('id')
    .ilike('name', name.trim())
    .limit(1)
  
  if (existing && existing.length > 0) return existing[0].id

  // Create new
  const { data: created } = await supabase
    .from('external_opponents')
    .insert({ name: name.trim(), slug, is_section_x: false })
    .select('id')
    .single()

  return created?.id || null
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const supabase = getAdminClient()
  const games = Array.isArray(body) ? body : [body]
  const results: { action: string; error?: string }[] = []

  for (const game of games) {
    const clean: Record<string, any> = {}
    for (const [k, v] of Object.entries(game)) {
      if (v !== undefined) clean[k] = v
    }

    // Handle external opponent names — create external_opponents records
    if (clean.external_home_name && !clean.home_team_id) {
      const extId = await findOrCreateExternalOpponent(supabase, clean.external_home_name)
      if (extId) clean.external_home_opponent_id = extId
      delete clean.external_home_name
    }
    if (clean.external_away_name && !clean.away_team_id) {
      const extId = await findOrCreateExternalOpponent(supabase, clean.external_away_name)
      if (extId) clean.external_away_opponent_id = extId
      delete clean.external_away_name
    }
    delete clean.external_home_name
    delete clean.external_away_name

    // Duplicate check
    if (clean.game_date && clean.sport_id && (clean.home_team_id || clean.away_team_id)) {
      let dupQuery = supabase.from('games').select('id').eq('game_date', clean.game_date).eq('sport_id', clean.sport_id)
      if (clean.home_team_id) dupQuery = dupQuery.eq('home_team_id', clean.home_team_id)
      if (clean.away_team_id) dupQuery = dupQuery.eq('away_team_id', clean.away_team_id)
      const { data: existing } = await dupQuery.limit(1)

      if (existing && existing.length > 0) {
        await supabase.from('games').update({
          home_score: clean.home_score ?? null,
          away_score: clean.away_score ?? null,
          status: clean.status ?? 'Final',
        }).eq('id', existing[0].id)
        results.push({ action: 'updated' })
        continue
      }
    }

    const { error } = await supabase.from('games').insert(clean)
    if (error) console.error('Insert error:', error.message, JSON.stringify(clean).slice(0, 200))
    results.push({ action: 'inserted', error: error?.message })
  }

  const errors = results.filter(r => r.error)
  return NextResponse.json({
    published: results.filter(r => !r.error).length,
    skipped: errors.length,
    errors: errors.map(e => e.error),
  })
}
