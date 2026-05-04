import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function findOrCreateExternalOpponent(supabase: any, name: string): Promise<string | null> {
  if (!name?.trim()) return null
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const { data: existing } = await supabase.from('external_opponents').select('id').ilike('name', name.trim()).limit(1)
  if (existing && existing.length > 0) return existing[0].id
  const { data: created } = await supabase.from('external_opponents')
    .insert({ name: name.trim(), slug, is_section_x: false })
    .select('id').single()
  return created?.id || null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = getAdminClient()
  const games = Array.isArray(body) ? body : [body]
  const results: { action: string; error?: string }[] = []

  for (const game of games) {
    const clean: Record<string, any> = {}
    for (const [k, v] of Object.entries(game)) {
      if (v !== undefined) clean[k] = v
    }

    // Resolve external opponent names to IDs
    if (clean.external_home_name) {
      const extId = await findOrCreateExternalOpponent(supabase, clean.external_home_name)
      if (extId) {
        clean.external_home_opponent_id = extId
        clean.home_team_id = null
      }
      delete clean.external_home_name
    }
    if (clean.external_away_name) {
      const extId = await findOrCreateExternalOpponent(supabase, clean.external_away_name)
      if (extId) {
        clean.external_away_opponent_id = extId
        clean.away_team_id = null
      }
      delete clean.external_away_name
    }

    // Sport validation - auto-correct wrong team sport
    if (clean.sport_id && clean.home_team_id) {
      const { data: ht } = await supabase.from('teams').select('sport_id, school_id').eq('id', clean.home_team_id).single()
      if (ht && ht.sport_id !== clean.sport_id) {
        const { data: ct } = await supabase.from('teams').select('id').eq('school_id', ht.school_id).eq('sport_id', clean.sport_id).single()
        clean.home_team_id = ct?.id || null
      }
    }
    if (clean.sport_id && clean.away_team_id) {
      const { data: at } = await supabase.from('teams').select('sport_id, school_id').eq('id', clean.away_team_id).single()
      if (at && at.sport_id !== clean.sport_id) {
        const { data: ct } = await supabase.from('teams').select('id').eq('school_id', at.school_id).eq('sport_id', clean.sport_id).single()
        clean.away_team_id = ct?.id || null
      }
    }

    // If game has an id it's a direct UPDATE
    if (clean.id) {
      const gameId = clean.id
      delete clean.id
      const { error } = await supabase.from('games').update(clean).eq('id', gameId)
      results.push({ action: 'updated', error: error?.message })
      continue
    }

    // DEDUP: only run when we have enough info to uniquely identify a game
    // Key insight: external opponent IDs MUST be part of the dedup key
    // otherwise SLC vs Unatego and SLC vs Avoca on same day would collide
    const gameNumber = clean.game_number ?? null
    const hasHomeId = !!clean.home_team_id
    const hasAwayId = !!clean.away_team_id
    const hasExtHome = !!clean.external_home_opponent_id
    const hasExtAway = !!clean.external_away_opponent_id

    // Only dedup if we have a full matchup (can identify both sides)
    const canDedup = clean.game_date && clean.sport_id && 
      (hasHomeId || hasExtHome) && (hasAwayId || hasExtAway)

    if (canDedup) {
      let dupQ = supabase.from('games')
        .select('id')
        .eq('game_date', clean.game_date)
        .eq('sport_id', clean.sport_id)

      // Match on Section X team ID if present, otherwise null
      if (hasHomeId) dupQ = dupQ.eq('home_team_id', clean.home_team_id)
      else dupQ = dupQ.is('home_team_id', null)

      if (hasAwayId) dupQ = dupQ.eq('away_team_id', clean.away_team_id)
      else dupQ = dupQ.is('away_team_id', null)

      // CRITICAL: also match on external opponent IDs to avoid false dedup
      if (hasExtHome) dupQ = dupQ.eq('external_home_opponent_id', clean.external_home_opponent_id)
      else dupQ = dupQ.is('external_home_opponent_id', null)

      if (hasExtAway) dupQ = dupQ.eq('external_away_opponent_id', clean.external_away_opponent_id)
      else dupQ = dupQ.is('external_away_opponent_id', null)

      if (gameNumber !== null) dupQ = dupQ.eq('game_number', gameNumber)
      else dupQ = dupQ.is('game_number', null)

      const { data: existing } = await dupQ.limit(1)
      if (existing && existing.length > 0) {
        const { error } = await supabase.from('games').update({
          home_score: clean.home_score ?? null,
          away_score: clean.away_score ?? null,
          status: clean.status ?? 'Final',
          game_time: clean.game_time ?? null,
          notes: clean.notes ?? null,
        }).eq('id', existing[0].id)
        results.push({ action: 'updated', error: error?.message })
        continue
      }
    }

    // Insert new game
    const { error } = await supabase.from('games').insert(clean)
    if (error) console.error('Insert error:', error.message, JSON.stringify(clean).slice(0, 300))
    results.push({ action: 'inserted', error: error?.message })
  }

  const errors = results.filter(r => r.error)
  return NextResponse.json({
    published: results.filter(r => !r.error).length,
    skipped: errors.length,
    errors: errors.map(e => e.error),
  })
}
