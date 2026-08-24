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

type Change = {
  field: string
  before: string | number | boolean | null
  after: string | number | boolean | null
}

function dayDiff(a: string, b: string) {
  const ta = new Date(`${a}T12:00:00`).getTime()
  const tb = new Date(`${b}T12:00:00`).getTime()
  return Math.abs(ta - tb) / 86400000
}

function internalPair(game: {
  home_team_id: string | null
  away_team_id: string | null
}) {
  if (!game.home_team_id || !game.away_team_id) return null
  return [game.home_team_id, game.away_team_id].sort().join('|')
}

function sameOrientation(a: IncomingGame, b: ExistingGame) {
  return (
    a.home_team_id === b.home_team_id &&
    a.away_team_id === b.away_team_id
  )
}

function normalizeDate(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!match) return raw
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function normalizeTime(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const twelveHour = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (twelveHour) {
    let hour = Number(twelveHour[1])
    const minute = twelveHour[2]
    const meridiem = twelveHour[3].toUpperCase()
    if (meridiem === 'AM' && hour === 12) hour = 0
    if (meridiem === 'PM' && hour !== 12) hour += 12
    return `${String(hour).padStart(2, '0')}:${minute}`
  }

  const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/)
  if (twentyFourHour) {
    return `${String(Number(twentyFourHour[1])).padStart(2, '0')}:${twentyFourHour[2]}`
  }

  return raw.toLowerCase().replace(/\s+/g, ' ')
}

function dbTime(value: unknown): string | null {
  const normalized = normalizeTime(value)
  return /^\d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized || null
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeStatus(value: unknown): string {
  const raw = normalizeText(value)
  if (!raw) return 'scheduled'
  if (raw === 'ppd' || raw === 'postponed') return 'postponed'
  if (raw === 'cancelled' || raw === 'canceled') return 'canceled'
  if (raw === 'final') return 'final'
  if (raw === 'live' || raw === 'in progress') return 'live'
  return raw
}

function displayStatus(value: unknown): string | null {
  const normalized = normalizeStatus(value)
  if (normalized === 'postponed') return 'Postponed'
  if (normalized === 'canceled') return 'Canceled'
  if (normalized === 'final') return 'Final'
  if (normalized === 'live') return 'Live'
  if (normalized === 'scheduled') return 'Scheduled'
  return String(value ?? '').trim() || null
}

function canonicalizeIncoming(game: IncomingGame): IncomingGame {
  return {
    ...game,
    game_date: game.game_date ? normalizeDate(game.game_date) : null,
    game_time: dbTime(game.game_time),
    location: String(game.location ?? '').trim() || null,
    status: displayStatus(game.status),
    rescheduled_date: game.rescheduled_date
      ? normalizeDate(game.rescheduled_date)
      : null,
    game_number:
      game.game_number === null || game.game_number === undefined
        ? null
        : Number(game.game_number),
    neutral_site: Boolean(game.neutral_site),
    event_name: String(game.event_name ?? '').trim() || null,
    notes: String(game.notes ?? '').trim() || null,
  }
}

function equivalent(field: string, before: unknown, after: unknown) {
  if (field === 'game_date' || field === 'rescheduled_date') {
    return normalizeDate(before) === normalizeDate(after)
  }
  if (field === 'game_time') {
    return normalizeTime(before) === normalizeTime(after)
  }
  if (field === 'location') {
    return normalizeText(before) === normalizeText(after)
  }
  if (field === 'status') {
    return normalizeStatus(before) === normalizeStatus(after)
  }
  if (field === 'game_number') {
    const a = before === null || before === undefined || before === '' ? null : Number(before)
    const b = after === null || after === undefined || after === '' ? null : Number(after)
    return a === b
  }
  if (field === 'neutral_site') {
    return Boolean(before) === Boolean(after)
  }
  return normalizeText(before) === normalizeText(after)
}

function changesFor(incoming: IncomingGame, existing: ExistingGame): Change[] {
  const changes: Change[] = []
  const fields = [
    'game_date',
    'game_time',
    'location',
    'status',
    'rescheduled_date',
    'game_number',
    'neutral_site',
  ] as const

  for (const field of fields) {
    const before = (existing as any)[field] ?? null
    const after = (incoming as any)[field] ?? null
    if (!equivalent(field, before, after)) {
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
    const rawIncoming: IncomingGame[] = Array.isArray(body?.games) ? body.games : []
    const incoming = rawIncoming
      .map(canonicalizeIncoming)
      .filter(game => game.game_date)

    if (!teamId || !seasonId || !sportId) {
      return NextResponse.json(
        { error: 'team_id, season_id and sport_id are required.' },
        { status: 400 }
      )
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

    const sourcedGameIds = new Set(
      (sourceRows || []).map((row: any) => row.game_id)
    )
    const matchedExisting = new Set<string>()
    const diffs: any[] = []

    for (const game of incoming) {
      const pair = internalPair(game)
      let match: ExistingGame | undefined
      let matchReason:
        | 'exact'
        | 'nearby'
        | 'orientation_conflict'
        | 'external_exact'
        | null = null

      if (pair) {
        match = existing.find(existingGame =>
          !matchedExisting.has(existingGame.id) &&
          internalPair(existingGame) === pair &&
          sameOrientation(game, existingGame) &&
          normalizeDate(existingGame.game_date) === normalizeDate(game.game_date) &&
          (existingGame.game_number ?? null) === (game.game_number ?? null)
        )
        if (match) matchReason = 'exact'

        if (!match) {
          match = existing
            .filter(existingGame =>
              !matchedExisting.has(existingGame.id) &&
              internalPair(existingGame) === pair &&
              sameOrientation(game, existingGame) &&
              dayDiff(existingGame.game_date, game.game_date!) <= 7 &&
              (existingGame.game_number ?? null) === (game.game_number ?? null)
            )
            .sort(
              (a, b) =>
                dayDiff(a.game_date, game.game_date!) -
                dayDiff(b.game_date, game.game_date!)
            )[0]
          if (match) matchReason = 'nearby'
        }

        if (!match) {
          match = existing
            .filter(existingGame =>
              !matchedExisting.has(existingGame.id) &&
              internalPair(existingGame) === pair &&
              dayDiff(existingGame.game_date, game.game_date!) <= 7
            )
            .sort(
              (a, b) =>
                dayDiff(a.game_date, game.game_date!) -
                dayDiff(b.game_date, game.game_date!)
            )[0]
          if (match) matchReason = 'orientation_conflict'
        }
      } else {
        match = existing.find(existingGame =>
          !matchedExisting.has(existingGame.id) &&
          normalizeDate(existingGame.game_date) === normalizeDate(game.game_date) &&
          (existingGame.game_number ?? null) === (game.game_number ?? null) &&
          (
            (game.home_team_id === teamId &&
              existingGame.home_team_id === teamId &&
              !!existingGame.external_away_opponent_id) ||
            (game.away_team_id === teamId &&
              existingGame.away_team_id === teamId &&
              !!existingGame.external_home_opponent_id)
          )
        )
        if (match) matchReason = 'external_exact'
      }

      if (!match) {
        const hasExternal =
          !!game.external_home_name || !!game.external_away_name

        diffs.push({
          key: `${hasExternal ? 'external' : 'new'}-${diffs.length}`,
          kind: hasExternal ? 'external_review' : 'new',
          safe: !hasExternal,
          incoming: game,
          existing: null,
          existing_game_id: null,
          changes: [],
          note: hasExternal
            ? 'Fresh external matchup has no confidently matched Section X record. Review once before adding it.'
            : undefined,
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
          note:
            'Same two teams found nearby, but home/away orientation differs. Review manually.',
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
        const changedFields = new Set(changes.map(change => change.field))
        const primaryKind = changedFields.has('game_time')
          ? 'time_changed'
          : changedFields.has('location')
            ? 'location_changed'
            : changedFields.has('status')
              ? 'status_changed'
              : changedFields.has('game_date')
                ? 'date_changed'
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
        note:
          'This game was previously imported from this team but was not found in the fresh Arbiter scan. Do not delete automatically.',
      })
    }

    const counts = diffs.reduce((acc: Record<string, number>, diff: any) => {
      acc[diff.kind] = (acc[diff.kind] || 0) + 1
      return acc
    }, {})

    const unchangedCount = counts.unchanged || 0
    const meaningfulSafeCount = diffs.filter(
      diff => diff.safe && diff.kind !== 'unchanged'
    ).length
    const safetyReasons: string[] = []

    if (
      existing.length >= 5 &&
      incoming.length >= 5 &&
      unchangedCount === 0 &&
      meaningfulSafeCount >= Math.min(5, Math.ceil(incoming.length * 0.6))
    ) {
      safetyReasons.push(
        'No unchanged games were found even though this team already has a full schedule. This usually indicates a parser or formatting mismatch, so applying is blocked.'
      )
    }

    const changeRatio =
      incoming.length > 0 ? meaningfulSafeCount / incoming.length : 0

    if (
      existing.length >= 8 &&
      incoming.length >= 8 &&
      changeRatio >= 0.85 &&
      unchangedCount <= 1
    ) {
      safetyReasons.push(
        'More than 85% of the schedule appears changed. Review the scan before any database update.'
      )
    }

    return NextResponse.json({
      success: true,
      scanned_at: new Date().toISOString(),
      existing_count: existing.length,
      incoming_count: incoming.length,
      safe_count: diffs.filter(diff => diff.safe).length,
      detected_change_count: meaningfulSafeCount,
      review_count: diffs.filter(diff => !diff.safe).length,
      counts,
      apply_allowed: safetyReasons.length === 0,
      safety_reasons: safetyReasons,
      normalization: 'v2',
      diffs,
    })
  } catch (error: any) {
    console.error('Schedule sync preview error:', error)
    return NextResponse.json(
      { error: error?.message || 'Could not compare the schedule.' },
      { status: 500 }
    )
  }
}
