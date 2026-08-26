import { NextRequest, NextResponse } from 'next/server'
import { ArbiterApiError, arbiterApi } from '@/lib/arbiter/client'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SECTION_X_SCHOOL_IDS = new Set([
  2630, 52120, 3988, 4543, 4769, 6714, 8736, 9356, 9563, 9923, 9954, 13012,
  13569, 7896, 14077, 15195, 16678, 16935, 17532, 18479, 20233, 20061, 20146,
  23855,
])
const SCHOOL_ID_LIST = Array.from(SECTION_X_SCHOOL_IDS)
const PRACTICE_TYPE_ID = 5
const CONTEST_TYPE_IDS = new Set([1, 2, 3, 4, 8])

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : value == null ? [] : [value]
}
function num(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
function isoDate(value: string | null, fallback: string) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString()
}
function clean(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}
function dateOnly(value: unknown) {
  const d = new Date(String(value || ''))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
function timeOnly(value: unknown) {
  const d = new Date(String(value || ''))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(11, 16)
}
function countBy<T extends string | number>(values: T[]) {
  const map = new Map<T, number>()
  for (const value of values) map.set(value, (map.get(value) || 0) + 1)
  return Array.from(map.entries()).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count)
}
function sportKey(value: unknown) {
  const s = clean(value)
  const aliases: Record<string, string> = {
    'soccer boys': 'boys soccer', 'soccer girls': 'girls soccer',
    'football boys': 'football', 'volleyball girls': 'volleyball',
    'cross country boys': 'boys cross country', 'cross country girls': 'girls cross country',
    'swimming girls': 'girls swimming', 'swimming boys': 'boys swimming',
  }
  return aliases[s] || s
}
function levelKey(value: unknown) {
  const s = clean(value)
  if (s.includes('varsity') && !s.includes('junior')) return 'varsity'
  if (s.includes('junior varsity') || s === 'jv') return 'jv'
  if (s.includes('modified')) return 'modified'
  return s
}
function teamSide(game: any, isHome: boolean) {
  const teams = asArray(game?.teams)
  const found = teams.find((team: any) => Boolean(team?.isHome) === isHome) || null
  if (!found) return { teamId: null, schoolId: null, teamName: null, schoolName: null, score: null, isMarkedWinner: null, isCoOp: false, isSectionX: false, isTba: true }
  const teamId = num(found.teamId)
  const schoolId = num(found.schoolId)
  const isTba = !teamId || teamId === 0 || !schoolId || schoolId === 0
  return {
    teamId, schoolId, teamName: found.teamName ?? null, schoolName: found.schoolName ?? null,
    score: found.score ?? null, isMarkedWinner: found.isMarkedWinner ?? null,
    isCoOp: Boolean(found.isCoop ?? found.isCoOp),
    isSectionX: schoolId !== null && SECTION_X_SCHOOL_IDS.has(schoolId), isTba,
  }
}
function normalizeGame(game: any) {
  const home = teamSide(game, true)
  const away = teamSide(game, false)
  const gameTypeId = num(game?.gameTypeId)
  const levelId = num(game?.levelId)
  const sectionXTeamCount = Number(home.isSectionX) + Number(away.isSectionX)
  return {
    uniqueGameId: num(game?.uniqueGameId), gameNumber: num(game?.gameNumber), groupId: num(game?.groupId),
    fromDate: game?.fromDate ?? null, toDate: game?.toDate ?? null, lastModifiedDate: game?.lastModifiedDate ?? null,
    sportId: num(game?.sportId), sportName: game?.sportName ?? null,
    levelId, levelName: game?.levelName ?? null, levelAlias: game?.levelAlias ?? null,
    genderId: num(game?.genderId), gender: game?.gender ?? null,
    gameTypeId, gameTypeName: game?.gameTypeName ?? null, statusId: num(game?.statusId), status: game?.status ?? null,
    title: game?.title ?? null, siteId: num(game?.siteId), siteName: game?.siteName ?? null,
    subSiteId: num(game?.subSiteId), subSiteName: game?.subSiteName ?? null, home, away,
    isPractice: gameTypeId === PRACTICE_TYPE_ID || clean(game?.gameTypeName) === 'practice',
    isContest: gameTypeId !== null && CONTEST_TYPE_IDS.has(gameTypeId),
    hasTba: home.isTba || away.isTba, hasScores: home.score !== null || away.score !== null,
    hasCoOpTeam: home.isCoOp || away.isCoOp, sectionXTeamCount,
    opponentScope: sectionXTeamCount === 2 ? 'section-x-vs-section-x' : sectionXTeamCount === 1 ? 'section-x-vs-external' : 'external-only',
  }
}

async function buildComparison(contests: any[], start: string, end: string) {
  const supabase = createAdminClient()
  const startDate = start.slice(0, 10)
  const endDate = end.slice(0, 10)
  const [schoolsRes, teamsRes, sportsRes, externalRes, gamesRes] = await Promise.all([
    supabase.from('schools').select('id,school_name,arbiter_entity_id').not('arbiter_entity_id', 'is', null),
    supabase.from('teams').select('id,school_id,sport_id,team_name,level,active'),
    supabase.from('sports').select('id,sport_name,gender,slug'),
    supabase.from('external_opponents').select('id,name'),
    supabase.from('games').select('id,game_date,game_time,sport_id,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id,status,contest_type,source').gte('game_date', startDate).lte('game_date', endDate),
  ])
  const dbError = schoolsRes.error || teamsRes.error || sportsRes.error || externalRes.error || gamesRes.error
  if (dbError) throw new Error(`Supabase comparison query failed: ${dbError.message}`)

  const schools = schoolsRes.data || []
  const teams = teamsRes.data || []
  const sports = sportsRes.data || []
  const externals = externalRes.data || []
  const existing = gamesRes.data || []
  const schoolByArbiter = new Map(schools.map((s: any) => [Number(s.arbiter_entity_id), s]))
  const externalByName = new Map(externals.map((e: any) => [clean(e.name), e]))

  function resolveSport(g: any) {
    const target = sportKey(g.sportName)
    return sports.find((s: any) => sportKey(s.sport_name) === target || sportKey(`${s.gender || ''} ${s.sport_name}`) === target) || null
  }
  function resolveSide(side: any, sport: any, levelName: any) {
    if (side.isTba) return { kind: 'tba', id: null, name: side.teamName || side.schoolName || null, mapped: false }
    if (side.isSectionX) {
      const school = schoolByArbiter.get(Number(side.schoolId))
      if (!school || !sport) return { kind: 'internal', id: null, name: side.schoolName || side.teamName, mapped: false }
      const candidates = teams.filter((t: any) => t.school_id === school.id && t.sport_id === sport.id && t.active !== false)
      const desiredLevel = levelKey(levelName)
      const team = candidates.find((t: any) => levelKey(t.level) === desiredLevel) || (desiredLevel === 'varsity' ? candidates.find((t: any) => levelKey(t.level) === 'varsity') : null)
      return { kind: 'internal', id: team?.id || null, name: team?.team_name || side.teamName || school.school_name, mapped: Boolean(team), schoolId: school.id }
    }
    const name = side.schoolName || side.teamName || ''
    const ext = externalByName.get(clean(name))
    return { kind: 'external', id: ext?.id || null, name, mapped: Boolean(ext) }
  }
  function participantToken(side: any) {
    return side.kind === 'internal' ? `t:${side.id}` : side.kind === 'external' ? `e:${side.id}` : 'tba'
  }
  function dbToken(game: any, home: boolean) {
    const team = home ? game.home_team_id : game.away_team_id
    const ext = home ? game.external_home_opponent_id : game.external_away_opponent_id
    return team ? `t:${team}` : ext ? `e:${ext}` : 'tba'
  }

  const rows = contests.map((g: any) => {
    const sport = resolveSport(g)
    const home = resolveSide(g.home, sport, g.levelName)
    const away = resolveSide(g.away, sport, g.levelName)
    const gameDate = dateOnly(g.fromDate)
    const gameTime = timeOnly(g.fromDate)
    const mappingIssues: string[] = []
    if (!sport) mappingIssues.push('sport')
    if (!home.mapped && home.kind !== 'tba') mappingIssues.push(`home-${home.kind}`)
    if (!away.mapped && away.kind !== 'tba') mappingIssues.push(`away-${away.kind}`)
    if (home.kind === 'tba' || away.kind === 'tba') mappingIssues.push('tba')

    let bucket = 'new-game'
    let match: any = null
    if (mappingIssues.length) {
      bucket = mappingIssues.includes('tba') ? 'manual-review' : 'mapping-needed'
    } else if (gameDate && sport) {
      const sameDaySport = existing.filter((x: any) => x.game_date === gameDate && x.sport_id === sport.id)
      const h = participantToken(home)
      const a = participantToken(away)
      const exact = sameDaySport.find((x: any) => dbToken(x, true) === h && dbToken(x, false) === a)
      const reversed = sameDaySport.find((x: any) => dbToken(x, true) === a && dbToken(x, false) === h)
      match = exact || reversed || null
      if (match) {
        const dbTime = String(match.game_time || '').slice(0, 5) || null
        bucket = !gameTime || !dbTime || gameTime === dbTime ? 'exact-match' : 'probable-match'
      }
    }
    return {
      bucket, uniqueGameId: g.uniqueGameId, date: gameDate, time: gameTime,
      sport: g.sportName, level: g.levelName, type: g.gameTypeName, status: g.status,
      home: { arbiter: g.home.schoolName || g.home.teamName, mapped: home.name, kind: home.kind, id: home.id },
      away: { arbiter: g.away.schoolName || g.away.teamName, mapped: away.name, kind: away.kind, id: away.id },
      mappingIssues, existingGameId: match?.id || null, existingTime: match?.game_time || null,
    }
  })
  const varsityRows = rows.filter((r: any) => levelKey(r.level) === 'varsity')
  const counts = Object.fromEntries(['exact-match','probable-match','new-game','mapping-needed','manual-review'].map(k => [k, varsityRows.filter((r: any) => r.bucket === k).length]))
  const blockers = counts['mapping-needed'] + counts['manual-review']
  return {
    targetScope: 'Varsity contests only', existingGamesInWindow: existing.length,
    allContestRows: rows.length, varsityContestRows: varsityRows.length, nonVarsitySkipped: rows.length - varsityRows.length,
    counts, blockers, safeToWrite: blockers === 0,
    samples: {
      probableMatches: varsityRows.filter((r: any) => r.bucket === 'probable-match').slice(0, 20),
      newGames: varsityRows.filter((r: any) => r.bucket === 'new-game').slice(0, 30),
      mappingNeeded: varsityRows.filter((r: any) => r.bucket === 'mapping-needed').slice(0, 30),
      manualReview: varsityRows.filter((r: any) => r.bucket === 'manual-review').slice(0, 30),
    },
  }
}

export async function GET(req: NextRequest) {
  const now = new Date()
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 7, 1)).toISOString()
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), 10, 30, 23, 59, 59)).toISOString()
  const start = isoDate(req.nextUrl.searchParams.get('start'), defaultStart)
  const end = isoDate(req.nextUrl.searchParams.get('end'), defaultEnd)
  try {
    const raw = await arbiterApi.games({ SchoolIds: SCHOOL_ID_LIST, DateFilter: 'Range', GameStartDate: start, GameEndDate: end, IncludeDeletedGames: false, IncludePendingInformation: false })
    const normalized = asArray(raw).map(normalizeGame)
    const uniqueIds = new Set<number>(), duplicateIds = new Set<number>()
    for (const game of normalized) {
      if (game.uniqueGameId === null) continue
      if (uniqueIds.has(game.uniqueGameId)) duplicateIds.add(game.uniqueGameId)
      uniqueIds.add(game.uniqueGameId)
    }
    const contests = normalized.filter(g => g.isContest && !g.isPractice)
    const practices = normalized.filter(g => g.isPractice)
    const other = normalized.filter(g => !g.isContest && !g.isPractice)
    const comparison = await buildComparison(contests, start, end)
    return NextResponse.json({
      ok: true, dryRun: true, writesPerformed: 0, window: { start, end },
      summary: {
        recordsReturned: normalized.length, uniqueGameIds: uniqueIds.size, duplicateUniqueGameIds: duplicateIds.size,
        contests: contests.length, practices: practices.length, otherRecords: other.length,
        varsityContests: contests.filter(g => g.levelId === 1).length,
        jvContests: contests.filter(g => g.levelId === 2).length,
        modifiedContests: contests.filter(g => [27, 30, 39].includes(g.levelId || -1)).length,
        sectionXVsSectionX: contests.filter(g => g.opponentScope === 'section-x-vs-section-x').length,
        sectionXVsExternal: contests.filter(g => g.opponentScope === 'section-x-vs-external').length,
        tbaContests: contests.filter(g => g.hasTba).length, scoredContests: contests.filter(g => g.hasScores).length,
        coOpContests: contests.filter(g => g.hasCoOpTeam).length,
      },
      breakdowns: {
        sports: countBy(normalized.map(g => g.sportName || `sport-${g.sportId ?? 'unknown'}`)),
        levels: countBy(normalized.map(g => g.levelName || `level-${g.levelId ?? 'unknown'}`)),
        gameTypes: countBy(normalized.map(g => g.gameTypeName || `type-${g.gameTypeId ?? 'unknown'}`)),
        statuses: countBy(normalized.map(g => g.status || `status-${g.statusId ?? 'unknown'}`)),
      },
      comparison,
      readiness: {
        normalizationFixed: true, comparisonGateBuilt: true,
        safeToWrite: false,
        nextGate: comparison.safeToWrite ? 'Comparison is clean. Add stable Arbiter game IDs and controlled upsert semantics before enabling writes.' : 'Resolve mapping/manual-review blockers before enabling writes.',
      },
      note: 'Read-only Arbiter normalization + Supabase comparison audit. No game writes are performed.',
    })
  } catch (error) {
    console.error('Arbiter game dry run error:', error)
    if (error instanceof ArbiterApiError) return NextResponse.json({ ok: false, dryRun: true, writesPerformed: 0, error: error.message, arbiterStatus: error.status, details: error.details }, { status: 502 })
    return NextResponse.json({ ok: false, dryRun: true, writesPerformed: 0, error: error instanceof Error ? error.message : 'Unknown Arbiter game dry run error' }, { status: 500 })
  }
}
