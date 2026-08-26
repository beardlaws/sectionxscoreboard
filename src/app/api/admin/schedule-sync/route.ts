import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { arbiterLocationsEquivalent, cleanArbiterLocation } from '@/lib/arbiter-location'

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
  contest_type?: 'Game' | 'Scrimmage' | string | null
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
  contest_type: string | null
  rescheduled_date: string | null
  game_number: number | null
  neutral_site: boolean | null
  event_name: string | null
  notes: string | null
  parser_confidence: string | null
}

type SchoolRef = { id: string; school_name: string; alias: string | null; city: string | null }
type TeamSchoolRef = { id: string; school_id: string | null }

type Change = {
  field: string
  before: string | number | boolean | null
  after: string | number | boolean | null
}

type MatchReason = 'exact' | 'nearby' | 'orientation_conflict' | 'external_exact'

type WorkingIncoming = {
  index: number
  game: IncomingGame
  match?: ExistingGame
  matchReason?: MatchReason
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
  if (twentyFourHour) return `${String(Number(twentyFourHour[1])).padStart(2, '0')}:${twentyFourHour[2]}`
  return raw.toLowerCase().replace(/\s+/g, ' ')
}

function dbTime(value: unknown): string | null {
  const normalized = normalizeTime(value)
  return /^\d{2}:\d{2}$/.test(normalized) ? `${normalized}:00` : normalized || null
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,]/g, '')
    .replace(/[^a-z0-9' ]+/g, ' ')
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

function normalizeContestType(value: unknown, notes?: unknown): 'Game' | 'Scrimmage' {
  const explicit = normalizeText(value)
  const noteText = normalizeText(notes)
  if (explicit === 'scrimmage' || /\barbiter type scrimmage\b/.test(noteText) || /\btype scrimmage\b/.test(noteText)) return 'Scrimmage'
  return 'Game'
}

function canonicalizeIncoming(game: IncomingGame): IncomingGame {
  const contestType = normalizeContestType(game.contest_type, game.notes)
  let status = displayStatus(game.status)
  if (contestType === 'Scrimmage' && status && ['Final', 'Live'].includes(status)) status = 'Scheduled'
  return {
    ...game,
    game_date: game.game_date ? normalizeDate(game.game_date) : null,
    game_time: dbTime(game.game_time),
    location: cleanArbiterLocation(game.location) || null,
    status,
    contest_type: contestType,
    rescheduled_date: game.rescheduled_date ? normalizeDate(game.rescheduled_date) : null,
    game_number: game.game_number === null || game.game_number === undefined ? null : Number(game.game_number),
    neutral_site: Boolean(game.neutral_site),
    event_name: String(game.event_name ?? '').trim() || null,
    notes: String(game.notes ?? '').trim() || null,
  }
}

function equivalent(field: string, before: unknown, after: unknown) {
  if (field === 'game_date' || field === 'rescheduled_date') return normalizeDate(before) === normalizeDate(after)
  if (field === 'game_time') return normalizeTime(before) === normalizeTime(after)
  if (field === 'location') return arbiterLocationsEquivalent(before, after)
  if (field === 'status') return normalizeStatus(before) === normalizeStatus(after)
  if (field === 'contest_type') return normalizeContestType(before) === normalizeContestType(after)
  if (field === 'game_number') {
    const a = before === null || before === undefined || before === '' ? null : Number(before)
    const b = after === null || after === undefined || after === '' ? null : Number(after)
    return a === b
  }
  if (field === 'neutral_site') return Boolean(before) === Boolean(after)
  return normalizeText(before) === normalizeText(after)
}

function changesFor(incoming: IncomingGame, existing: ExistingGame): Change[] {
  const changes: Change[] = []
  const fields = ['game_date','game_time','location','status','contest_type','rescheduled_date','game_number','neutral_site'] as const
  for (const field of fields) {
    const before = (existing as any)[field] ?? null
    const after = (incoming as any)[field] ?? null
    if (!equivalent(field, before, after)) changes.push({ field, before, after })
  }
  return changes
}

function isTimeStatusOnly(changes: Change[]) {
  if (!changes.length) return true
  const fields = new Set(changes.map(change => change.field))
  return [...fields].every(field => field === 'game_time' || field === 'status')
}

function isSafeExactUpdate(changes: Change[], incoming: IncomingGame) {
  if (!isTimeStatusOnly(changes)) return false
  if (incoming.home_team_id && incoming.away_team_id) return false
  if (normalizeContestType(incoming.contest_type, incoming.notes) === 'Scrimmage') return false
  return true
}

function orientationScheduleAgrees(incoming: IncomingGame, existing: ExistingGame) {
  return normalizeDate(incoming.game_date) === normalizeDate(existing.game_date) &&
    normalizeTime(incoming.game_time) === normalizeTime(existing.game_time) &&
    normalizeStatus(incoming.status) === normalizeStatus(existing.status) &&
    normalizeContestType(incoming.contest_type, incoming.notes) === normalizeContestType(existing.contest_type, existing.notes) &&
    (incoming.game_number ?? null) === (existing.game_number ?? null)
}

function schoolTokens(school: SchoolRef): string[] {
  const values = [school.school_name, school.alias, school.city].filter(Boolean).map(normalizeText).filter(Boolean)
  const expanded = values.flatMap(value => {
    const trimmed = value
      .replace(/\bcentral school\b/g, '')
      .replace(/\bcentral high school\b/g, '')
      .replace(/\bhigh school\b/g, '')
      .replace(/\bfree academy\b/g, 'free academy')
      .trim()
    return trimmed && trimmed !== value ? [value, trimmed] : [value]
  })
  return [...new Set(expanded.filter(value => value.length >= 4))]
}

function venueMentionsSchool(location: string | null | undefined, school: SchoolRef): boolean {
  const venue = normalizeText(location)
  if (!venue) return false
  return schoolTokens(school).some(token => venue.includes(token))
}

function findForeignVenueSchool(
  location: string | null | undefined,
  game: IncomingGame,
  teamSchoolById: Map<string, string | null>,
  schools: SchoolRef[]
): SchoolRef | null {
  if (!location || game.neutral_site) return null
  const participantSchoolIds = new Set<string>()
  for (const teamId of [game.home_team_id, game.away_team_id]) {
    if (!teamId) continue
    const schoolId = teamSchoolById.get(teamId)
    if (schoolId) participantSchoolIds.add(schoolId)
  }
  for (const school of schools) {
    if (participantSchoolIds.has(school.id)) continue
    if (venueMentionsSchool(location, school)) return school
  }
  return null
}

function isAuthoritativeExternalNew(game: IncomingGame, teamId: string) {
  const hasExternal = !!game.external_home_name || !!game.external_away_name
  const sourceParticipates = game.home_team_id === teamId || game.away_team_id === teamId
  const confidence = normalizeText(game.parser_confidence)
  return hasExternal && sourceParticipates && confidence !== 'low'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const teamId = typeof body?.team_id === 'string' ? body.team_id : ''
    const seasonId = typeof body?.season_id === 'string' ? body.season_id : ''
    const sportId = typeof body?.sport_id === 'string' ? body.sport_id : ''
    const rawIncoming: IncomingGame[] = Array.isArray(body?.games) ? body.games : []
    const incoming = rawIncoming.map(canonicalizeIncoming).filter(game => game.game_date)

    if (!teamId || !seasonId || !sportId) {
      return NextResponse.json({ error: 'team_id, season_id and sport_id are required.' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const [{ data: existingRows, error: existingError }, { data: schoolRows, error: schoolError }, { data: teamRows, error: teamError }] = await Promise.all([
      supabase
        .from('games')
        .select(`id, game_date, game_time, location, home_team_id, away_team_id,
          external_home_opponent_id, external_away_opponent_id, status, contest_type, rescheduled_date,
          game_number, neutral_site, event_name, notes, parser_confidence`)
        .eq('season_id', seasonId)
        .eq('sport_id', sportId)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order('game_date', { ascending: true }),
      supabase.from('schools').select('id, school_name, alias, city').eq('active', true).eq('is_section_x', true),
      supabase.from('teams').select('id, school_id').eq('sport_id', sportId),
    ])

    if (existingError) throw new Error(`Could not load existing games: ${existingError.message}`)
    if (schoolError) throw new Error(`Could not load Section X schools: ${schoolError.message}`)
    if (teamError) throw new Error(`Could not load team-school map: ${teamError.message}`)

    const existing = (existingRows || []) as ExistingGame[]
    const schools = (schoolRows || []) as SchoolRef[]
    const teamSchoolById = new Map((teamRows || []).map((row: TeamSchoolRef) => [row.id, row.school_id]))

    const { data: sourceRows, error: sourceError } = await supabase
      .from('game_import_sources')
      .select('game_id')
      .eq('team_id', teamId)
      .eq('season_id', seasonId)
      .eq('sport_id', sportId)

    if (sourceError) throw new Error(`Could not load source history: ${sourceError.message}`)
    const sourcedGameIds = new Set((sourceRows || []).map((row: any) => row.game_id))

    const work: WorkingIncoming[] = incoming.map((game, index) => ({ index, game }))
    const matchedExisting = new Set<string>()

    for (const item of work) {
      const pair = internalPair(item.game)
      if (!pair) continue
      const match = existing.find(existingGame =>
        !matchedExisting.has(existingGame.id) &&
        internalPair(existingGame) === pair &&
        sameOrientation(item.game, existingGame) &&
        normalizeDate(existingGame.game_date) === normalizeDate(item.game.game_date) &&
        (existingGame.game_number ?? null) === (item.game.game_number ?? null)
      )
      if (match) {
        item.match = match
        item.matchReason = 'exact'
        matchedExisting.add(match.id)
      }
    }

    for (const item of work) {
      if (item.match || internalPair(item.game)) continue
      const game = item.game
      const match = existing.find(existingGame =>
        !matchedExisting.has(existingGame.id) &&
        normalizeDate(existingGame.game_date) === normalizeDate(game.game_date) &&
        (existingGame.game_number ?? null) === (game.game_number ?? null) &&
        ((game.home_team_id === teamId && existingGame.home_team_id === teamId && !!existingGame.external_away_opponent_id) ||
         (game.away_team_id === teamId && existingGame.away_team_id === teamId && !!existingGame.external_home_opponent_id))
      )
      if (match) {
        item.match = match
        item.matchReason = 'external_exact'
        matchedExisting.add(match.id)
      }
    }

    for (const item of work) {
      if (item.match) continue
      const pair = internalPair(item.game)
      if (!pair) continue
      const candidates = existing
        .filter(existingGame =>
          !matchedExisting.has(existingGame.id) &&
          internalPair(existingGame) === pair &&
          sameOrientation(item.game, existingGame) &&
          dayDiff(existingGame.game_date, item.game.game_date!) <= 3 &&
          (existingGame.game_number ?? null) === (item.game.game_number ?? null)
        )
        .sort((a, b) => dayDiff(a.game_date, item.game.game_date!) - dayDiff(b.game_date, item.game.game_date!))
      if (candidates.length === 1) {
        item.match = candidates[0]
        item.matchReason = 'nearby'
        matchedExisting.add(candidates[0].id)
      }
    }

    for (const item of work) {
      if (item.match) continue
      const pair = internalPair(item.game)
      if (!pair) continue
      const candidates = existing
        .filter(existingGame =>
          !matchedExisting.has(existingGame.id) &&
          internalPair(existingGame) === pair &&
          dayDiff(existingGame.game_date, item.game.game_date!) <= 3
        )
        .sort((a, b) => dayDiff(a.game_date, item.game.game_date!) - dayDiff(b.game_date, item.game.game_date!))
      if (candidates.length === 1) {
        item.match = candidates[0]
        item.matchReason = 'orientation_conflict'
        matchedExisting.add(candidates[0].id)
      }
    }

    const diffs: any[] = []

    for (const item of work) {
      const game = item.game
      const match = item.match
      const matchReason = item.matchReason
      const contestType = normalizeContestType(game.contest_type, game.notes)

      if (!match) {
        const hasExternal = !!game.external_home_name || !!game.external_away_name
        const authoritativeExternal = isAuthoritativeExternalNew(game, teamId)
        diffs.push({
          key: `${hasExternal ? 'external' : 'new'}-${item.index}`,
          kind: authoritativeExternal ? 'new' : hasExternal ? 'external_review' : 'new',
          safe: false,
          incoming: game,
          existing: null,
          existing_game_id: null,
          changes: [],
          new_confidence: authoritativeExternal ? 'confirmed' : hasExternal ? 'external' : 'single_source',
          note: authoritativeExternal
            ? `${contestType === 'Scrimmage' ? 'Scrimmage' : 'External-opponent game'} is published on this Section X team's fresh Arbiter schedule. Because the opponent is outside Section X, a second Section X source does not exist; this source is authoritative for the matchup and may be added after explicit confirmation.`
            : hasExternal
              ? 'Fresh external matchup could not be safely tied to this Section X team source. Review the full matchup before adding it.'
              : 'Fresh internal game has no existing Section X record. Scan All will cross-check the opponent schedule before this is treated as confirmed.',
        })
        continue
      }

      const changes = changesFor(game, match)
      const foreignVenue = changes.some(change => change.field === 'location')
        ? findForeignVenueSchool(game.location, game, teamSchoolById, schools)
        : null

      if (foreignVenue) {
        diffs.push({
          key: match.id,
          kind: 'conflict',
          safe: false,
          incoming: game,
          existing: match,
          existing_game_id: match.id,
          changes,
          note: `Venue safety guard: the fresh venue references ${foreignVenue.school_name}, which is not a participant in this matchup. This is likely parser/event leakage or a neutral-site event missing its neutral-site flag. Never auto-apply this venue; review the Arbiter event directly.`,
        })
        continue
      }

      if (matchReason === 'orientation_conflict') {
        const scheduleAgrees = orientationScheduleAgrees(game, match)
        diffs.push({
          key: match.id,
          kind: scheduleAgrees ? 'details_changed' : 'conflict',
          safe: false,
          incoming: game,
          existing: match,
          existing_game_id: match.id,
          changes,
          note: scheduleAgrees
            ? 'Orientation review only: both records agree on teams, date, time, status and contest type, but home/away orientation differs. Review home/away before changing anything.'
            : 'Same two teams found nearby, but home/away orientation or schedule fields disagree. Treat as a true source conflict; never auto-apply this matchup.',
        })
      } else if (matchReason === 'nearby') {
        const difference = Math.round(dayDiff(match.game_date, game.game_date!))
        diffs.push({
          key: match.id,
          kind: 'date_changed',
          safe: false,
          incoming: game,
          existing: match,
          existing_game_id: match.id,
          changes,
          note: `Possible reschedule detected (${difference} day difference). Date changes are never auto-written. A one-day difference is specifically held for human review so a parsing/date-boundary issue cannot silently move a game.`,
        })
      } else if (changes.length === 0) {
        diffs.push({ key: match.id, kind: 'unchanged', safe: true, incoming: game, existing: match, existing_game_id: match.id, changes: [] })
      } else {
        const changedFields = new Set(changes.map(change => change.field))
        const primaryKind = changedFields.has('game_date') ? 'date_changed'
          : changedFields.has('game_time') ? 'time_changed'
          : changedFields.has('location') ? 'location_changed'
          : changedFields.has('status') ? 'status_changed'
          : 'details_changed'
        const safe = isSafeExactUpdate(changes, game)
        const needsCrossSource = Boolean(game.home_team_id && game.away_team_id && isTimeStatusOnly(changes))
        const contestTypeChanged = changedFields.has('contest_type')
        diffs.push({
          key: match.id,
          kind: primaryKind,
          safe: contestTypeChanged ? false : safe,
          incoming: game,
          existing: match,
          existing_game_id: match.id,
          changes,
          note: contestTypeChanged
            ? `Contest type changed to ${contestType}. Scrimmage/game classification is never auto-written by Schedule Intelligence; review this event type explicitly.`
            : safe
              ? undefined
              : needsCrossSource
                ? 'Section X vs Section X time/status changes require agreement from both fresh team sources. No database write is allowed from one side alone.'
                : primaryKind === 'location_changed'
                  ? 'Venue differs after normalization. This venue does not reference an unrelated Section X school, but still requires explicit review before updating the game.'
                  : 'Exact matchup found, but this field change requires an explicit review before updating the game.',
          reconciliation_required: contestTypeChanged ? false : needsCrossSource,
        })
      }
    }

    for (const game of existing) {
      if (matchedExisting.has(game.id) || !sourcedGameIds.has(game.id)) continue
      const isScrimmage = normalizeContestType(game.contest_type, game.notes) === 'Scrimmage'
      diffs.push({
        key: `removed-${game.id}`,
        kind: 'possible_removed',
        safe: false,
        incoming: null,
        existing: game,
        existing_game_id: game.id,
        changes: [],
        note: isScrimmage
          ? 'Previously imported scrimmage is missing from this fresh Arbiter source. Scrimmages can change frequently; treat this only as evidence of absence. Never delete automatically.'
          : 'Previously imported from this team but missing from this one fresh Arbiter source. This is evidence of absence, not proof of deletion. Never delete automatically; use the opponent source or canonical provider event to confirm.',
      })
    }

    const counts = diffs.reduce((acc: Record<string, number>, diff: any) => {
      acc[diff.kind] = (acc[diff.kind] || 0) + 1
      return acc
    }, {})

    const unchangedCount = counts.unchanged || 0
    const bulkSafeChanges = diffs.filter(diff => diff.safe && diff.kind !== 'unchanged').length
    const reviewCount = diffs.filter(diff => !diff.safe).length
    const safetyReasons: string[] = []

    if (existing.length >= 5 && incoming.length >= 5 && unchangedCount === 0 && (bulkSafeChanges + reviewCount) >= Math.min(5, Math.ceil(incoming.length * 0.6))) {
      safetyReasons.push('No unchanged games were found even though this team already has a full schedule. This usually indicates a parser or matching problem.')
    }
    const suspiciousRatio = incoming.length > 0 ? (bulkSafeChanges + reviewCount) / incoming.length : 0
    if (existing.length >= 8 && incoming.length >= 8 && suspiciousRatio >= 0.85 && unchangedCount <= 1) {
      safetyReasons.push('More than 85% of the schedule appears different. Review the scan before any database update.')
    }

    return NextResponse.json({
      success: true,
      scanned_at: new Date().toISOString(),
      existing_count: existing.length,
      incoming_count: incoming.length,
      safe_count: diffs.filter(diff => diff.safe).length,
      detected_change_count: diffs.filter(diff => diff.kind !== 'unchanged' && diff.kind !== 'possible_removed').length,
      bulk_safe_change_count: bulkSafeChanges,
      new_game_count: (counts.new || 0) + (counts.external_review || 0),
      review_count: reviewCount,
      counts,
      apply_allowed: safetyReasons.length === 0,
      safety_reasons: safetyReasons,
      normalization: 'v9-scrimmage-external-venue-guard',
      diffs,
    })
  } catch (error: any) {
    console.error('Schedule sync preview error:', error)
    return NextResponse.json({ error: error?.message || 'Could not compare the schedule.' }, { status: 500 })
  }
}
