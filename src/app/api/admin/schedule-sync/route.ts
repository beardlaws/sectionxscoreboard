import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

type IncomingGame = {
  game_date: string | null
  game_time: string | null
  location?: string | null
  home_team_id: string | null
  away_team_id: string | null
  external_home_name?: string | null
  external_away_name?: string | null
  status?: string | null
  rescheduled_date?: string | null
  game_number?: number | null
  neutral_site?: boolean
  event_name?: string | null
  notes?: string | null
  parser_confidence?: string | null
}

type ExistingGame = {
  id: string
  game_date: string
  game_time: string | null
  location: string | null
  home_team_id: string | null
  away_team_id: string | null
  external_home_opponent_id: string | null
  external_away_opponent_id: string | null
  status: string
  rescheduled_date: string | null
  game_number: number | null
  neutral_site: boolean | null
  event_name: string | null
  notes: string | null
  parser_confidence: string | null
}

function dayDiff(a: string, b: string) {
  const ta = new Date(`${a}T12:00:00`).getTime()
  const tb = new Date(`${b}T12:00:00`).getTime()
  return Math.abs(ta - tb) / 86400000
}

function internalPair(game: { home_team_id: string | null; away_team_id: string | null }) {
  if (!game.home_team_id || !game.away_team_id) return null
  return [game.home_team_id, game.away_team_id].sort().join('|')
}

function sameOrientation(a: IncomingGame, b: ExistingGame) {
  return a.home_team_id === b.home_team_id && a.away_team_id === b.away_team_id
}

function changesFor(incoming: IncomingGame, existing: ExistingGame) {
  const changes: Array<{ field: string; before: string | number | boolean | null; after: string | number | boolean | null }> = []
  const fields: Array<keyof IncomingGame> = [
    'game_date',
    'game_time',
    'location',
    'status',
    'rescheduled_date',
    'game_number',
    'neutral_site',
    'event_name',
    'notes',
  ]

  for (const field of fields) {
    const before = (existing as any)[field] ?? null
    const after = (incoming as any)[field] ?? null
    if (String(before ?? '') !== String(after ?? '')) {
      changes.push({ field, before, after })
    }
  }

  return changes
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const teamId = typeof body?.team_id === 'string' ? body.team_id : ''
    const seasonId = typeof body?.season_id === 'string' ? body.season_id : ''
    const sportId = typeof body?.sport_id === 'string' ? body.sport_id : ''
    const incoming: IncomingGame[] = Array.isArray(body?.games) ? body.games : []

    if (!teamId || !seasonId || !sportId) {
      return NextResponse.json({ error: 'team_id, season_id and sport_id are required.' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { data: existingRows, error: existingError } = await supabase
      .from('games')
      .select(`
        id, game_date, game_time, location,
        home_team_id, away_team_id,
        external_home_opponent_id, external_away_opponent_id,
        status, rescheduled_date, game_number, neutral_site,
        event_name, notes, parser_confidence
      `)
      .eq('season_id', seasonId)
      .eq('sport_id', sportId)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('game_date', { ascending: true })

    if (existingError) {
      throw new Error(`Could not load existing games: ${existingError.message}`)
    }

    const existing = (existingRows || []) as ExistingGame[]

    const { data: sourceRows, error: sourceError } = await supabase
      .from('game_import_sources')
      .select('game_id')
      .eq('team_id', teamId)
      .eq('season_id', seasonId)
      .eq('sport_id', sportId)

    if (sourceError) {
      throw new Error(`Could not load source history: ${sourceError.message}`)
    }

    const sourcedGameIds = new Set((sourceRows || []).map((r: any) => r.game_id))
    const matchedExisting = new Set<string>()
    const diffs: any[] = []

    for (const game of incoming.filter(g => g.game_date)) {
      const pair = internalPair(game)

      let match: ExistingGame | undefined
      let matchReason: 'exact' | 'nearby' | 'orientation_conflict' | null = null

      if (pair) {
        match = existing.find(e =>
          !matchedExisting.has(e.id) &&
          internalPair(e) === pair &&
          sameOrientation(game, e) &&
          e.game_date === game.game_date &&
          (e.game_number ?? null) === (game.game_number ?? null)
        )
        if (match) matchReason = 'exact'

        if (!match) {
          match = existing
            .filter(e =>
              !matchedExisting.has(e.id) &&
              internalPair(e) === pair &&
              sameOrientation(game, e) &&
              dayDiff(e.game_date, game.game_date!) <= 7 &&
              (e.game_number ?? null) === (game.game_number ?? null)
            )
            .sort((a, b) => dayDiff(a.game_date, game.game_date!) - dayDiff(b.game_date, game.game_date!))[0]
          if (match) matchReason = 'nearby'
        }

        if (!match) {
          match = existing
            .filter(e =>
              !matchedExisting.has(e.id) &&
              internalPair(e) === pair &&
              dayDiff(e.game_date, game.game_date!) <= 7
            )
            .sort((a, b) => dayDiff(a.game_date, game.game_date!) - dayDiff(b.game_date, game.game_date!))[0]
          if (match) matchReason = 'orientation_conflict'
        }
      } else {
        // External opponents cannot be safely fuzzy-matched without resolving the
        // external opponent first. Exact-date team participation is still useful.
        match = existing.find(e =>
          !matchedExisting.has(e.id) &&
          e.game_date === game.game_date &&
          (e.home_team_id === teamId || e.away_team_id === teamId) &&
          (e.game_number ?? null) === (game.game_number ?? null)
        )
        if (match) matchReason = 'exact'
      }

      if (!match) {
        diffs.push({
          key: `new-${diffs.length}`,
          kind: 'new',
          safe: true,
          incoming: game,
          existing: null,
          existing_game_id: null,
          changes: [],
        })
        continue
      }

      matchedExisting.add(match.id)
      const changes = changesFor(game, match)

      if (matchReason === 'orientation_conflict') {
        diffs.push({
          key: match.id,
          kind: 'conflict',
          safe: false,
          incoming: game,
          existing: match,
          existing_game_id: match.id,
          changes,
          note: 'Same two teams found nearby, but home/away orientation differs. Review manually.',
        })
      } else if (matchReason === 'nearby') {
        diffs.push({
          key: match.id,
          kind: 'date_changed',
          safe: true,
          incoming: game,
          existing: match,
          existing_game_id: match.id,
          changes,
        })
      } else if (changes.length === 0) {
        diffs.push({
          key: match.id,
          kind: 'unchanged',
          safe: true,
          incoming: game,
          existing: match,
          existing_game_id: match.id,
          changes: [],
        })
      } else {
        const changedFields = new Set(changes.map(c => c.field))
        const primaryKind = changedFields.has('game_time')
          ? 'time_changed'
          : changedFields.has('location')
            ? 'location_changed'
            : changedFields.has('status')
              ? 'status_changed'
              : 'details_changed'

        diffs.push({
          key: match.id,
          kind: primaryKind,
          safe: true,
          incoming: game,
          existing: match,
          existing_game_id: match.id,
          changes,
        })
      }
    }

    for (const game of existing) {
      if (matchedExisting.has(game.id)) continue
      if (!sourcedGameIds.has(game.id)) continue

      diffs.push({
        key: `removed-${game.id}`,
        kind: 'possible_removed',
        safe: false,
        incoming: null,
        existing: game,
        existing_game_id: game.id,
        changes: [],
        note: 'This game was previously imported from this team but was not found in the fresh Arbiter scan. Do not delete automatically.',
      })
    }

    const counts = diffs.reduce((acc: Record<string, number>, diff: any) => {
      acc[diff.kind] = (acc[diff.kind] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      scanned_at: new Date().toISOString(),
      existing_count: existing.length,
      incoming_count: incoming.length,
      safe_count: diffs.filter(d => d.safe).length,
      review_count: diffs.filter(d => !d.safe).length,
      counts,
      diffs,
    })
  } catch (error: any) {
    console.error('Schedule sync preview error:', error)
    return NextResponse.json({ error: error?.message || 'Could not compare the schedule.' }, { status: 500 })
  }
}
