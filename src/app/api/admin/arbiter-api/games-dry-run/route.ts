import { NextRequest, NextResponse } from 'next/server'
import { ArbiterApiError, arbiterApi } from '@/lib/arbiter/client'

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

function countBy<T extends string | number>(values: T[]) {
  const map = new Map<T, number>()
  for (const value of values) map.set(value, (map.get(value) || 0) + 1)
  return Array.from(map.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
}

function teamSide(game: any, isHome: boolean) {
  const teams = asArray(game?.teams)
  const found = teams.find((team: any) => Boolean(team?.isHome) === isHome) || null

  if (!found) {
    return {
      teamId: null,
      schoolId: null,
      teamName: null,
      schoolName: null,
      score: null,
      isMarkedWinner: null,
      isCoOp: false,
      isSectionX: false,
      isTba: true,
    }
  }

  const teamId = num(found.teamId)
  const schoolId = num(found.schoolId)
  const isTba = !teamId || teamId === 0 || !schoolId || schoolId === 0

  return {
    teamId,
    schoolId,
    teamName: found.teamName ?? null,
    schoolName: found.schoolName ?? null,
    score: found.score ?? null,
    isMarkedWinner: found.isMarkedWinner ?? null,
    isCoOp: Boolean(found.isCoop ?? found.isCoOp),
    isSectionX: schoolId !== null && SECTION_X_SCHOOL_IDS.has(schoolId),
    isTba,
  }
}

function normalizeGame(game: any) {
  const home = teamSide(game, true)
  const away = teamSide(game, false)
  const gameTypeId = num(game?.gameTypeId)
  const statusId = num(game?.statusId)
  const sportId = num(game?.sportId)
  const levelId = num(game?.levelId)
  const genderId = num(game?.genderId)
  const uniqueGameId = num(game?.uniqueGameId)

  const isPractice = gameTypeId === PRACTICE_TYPE_ID || String(game?.gameTypeName || '').toLowerCase() === 'practice'
  const isContest = gameTypeId !== null && CONTEST_TYPE_IDS.has(gameTypeId)
  const sectionXTeamCount = Number(home.isSectionX) + Number(away.isSectionX)
  const opponentScope = sectionXTeamCount === 2
    ? 'section-x-vs-section-x'
    : sectionXTeamCount === 1
      ? 'section-x-vs-external'
      : 'external-only'

  const hasTba = home.isTba || away.isTba
  const hasScores = home.score !== null || away.score !== null

  return {
    uniqueGameId,
    gameNumber: num(game?.gameNumber),
    groupId: num(game?.groupId),
    fromDate: game?.fromDate ?? null,
    toDate: game?.toDate ?? null,
    utcOffset: game?.utcOffset ?? null,
    timeZone: game?.timeZone ?? null,
    lastModifiedDate: game?.lastModifiedDate ?? null,
    sportId,
    sportName: game?.sportName ?? null,
    levelId,
    levelName: game?.levelName ?? null,
    levelAlias: game?.levelAlias ?? null,
    genderId,
    gender: game?.gender ?? null,
    gameTypeId,
    gameTypeName: game?.gameTypeName ?? null,
    statusId,
    status: game?.status ?? null,
    title: game?.title ?? null,
    isDeleted: Boolean(game?.isDeleted),
    hasPendingRequest: Boolean(game?.hasPendingRequest),
    siteId: num(game?.siteId),
    siteName: game?.siteName ?? null,
    subSiteId: num(game?.subSiteId),
    subSiteName: game?.subSiteName ?? null,
    home,
    away,
    isPractice,
    isContest,
    hasTba,
    hasScores,
    hasCoOpTeam: home.isCoOp || away.isCoOp,
    sectionXTeamCount,
    opponentScope,
  }
}

export async function GET(req: NextRequest) {
  const now = new Date()
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 7, 1)).toISOString()
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), 10, 30, 23, 59, 59)).toISOString()

  const start = isoDate(req.nextUrl.searchParams.get('start'), defaultStart)
  const end = isoDate(req.nextUrl.searchParams.get('end'), defaultEnd)

  try {
    const raw = await arbiterApi.games({
      SchoolIds: SCHOOL_ID_LIST,
      DateFilter: 'Range',
      GameStartDate: start,
      GameEndDate: end,
      IncludeDeletedGames: false,
      IncludePendingInformation: false,
    })

    const normalized = asArray(raw).map(normalizeGame)
    const uniqueIds = new Set<number>()
    const duplicateIds = new Set<number>()

    for (const game of normalized) {
      if (game.uniqueGameId === null) continue
      if (uniqueIds.has(game.uniqueGameId)) duplicateIds.add(game.uniqueGameId)
      uniqueIds.add(game.uniqueGameId)
    }

    const contests = normalized.filter(game => game.isContest && !game.isPractice)
    const practices = normalized.filter(game => game.isPractice)
    const other = normalized.filter(game => !game.isContest && !game.isPractice)

    const varsity = contests.filter(game => game.levelId === 1)
    const jv = contests.filter(game => game.levelId === 2)
    const modified = contests.filter(game => [27, 30, 39].includes(game.levelId || -1))

    const sectionXVsSectionX = contests.filter(game => game.opponentScope === 'section-x-vs-section-x')
    const sectionXVsExternal = contests.filter(game => game.opponentScope === 'section-x-vs-external')
    const externalOnly = contests.filter(game => game.opponentScope === 'external-only')
    const tbaContests = contests.filter(game => game.hasTba)
    const scoredContests = contests.filter(game => game.hasScores)
    const coOpContests = contests.filter(game => game.hasCoOpTeam)

    return NextResponse.json({
      ok: true,
      dryRun: true,
      writesPerformed: 0,
      window: { start, end },
      summary: {
        recordsReturned: normalized.length,
        uniqueGameIds: uniqueIds.size,
        duplicateUniqueGameIds: duplicateIds.size,
        contests: contests.length,
        practices: practices.length,
        otherRecords: other.length,
        varsityContests: varsity.length,
        jvContests: jv.length,
        modifiedContests: modified.length,
        sectionXVsSectionX: sectionXVsSectionX.length,
        sectionXVsExternal: sectionXVsExternal.length,
        externalOnly: externalOnly.length,
        tbaContests: tbaContests.length,
        scoredContests: scoredContests.length,
        coOpContests: coOpContests.length,
        missingUniqueGameId: normalized.filter(game => game.uniqueGameId === null).length,
        missingFromDate: normalized.filter(game => !game.fromDate).length,
        contestsMissingHomeTeam: contests.filter(game => game.home.isTba).length,
        contestsMissingAwayTeam: contests.filter(game => game.away.isTba).length,
      },
      breakdowns: {
        sports: countBy(normalized.map(game => game.sportName || `sport-${game.sportId ?? 'unknown'}`)),
        levels: countBy(normalized.map(game => game.levelName || `level-${game.levelId ?? 'unknown'}`)),
        genders: countBy(normalized.map(game => game.gender || `gender-${game.genderId ?? 'unknown'}`)),
        gameTypes: countBy(normalized.map(game => game.gameTypeName || `type-${game.gameTypeId ?? 'unknown'}`)),
        statuses: countBy(normalized.map(game => game.status || `status-${game.statusId ?? 'unknown'}`)),
        contestScopes: countBy(contests.map(game => game.opponentScope)),
      },
      duplicateUniqueGameIds: Array.from(duplicateIds).slice(0, 100),
      samples: {
        contests: contests.slice(0, 20),
        practices: practices.slice(0, 10),
        tbaContests: tbaContests.slice(0, 10),
        externalOpponents: sectionXVsExternal.slice(0, 10),
        coOps: coOpContests.slice(0, 10),
      },
      readiness: {
        normalizationFixed: true,
        safeToWrite: false,
        nextGate: 'Compare normalized Arbiter contests against existing Supabase games and team mappings before enabling writes.',
      },
      note: 'Read-only Arbiter normalization audit. Practices are separated from contests. No Supabase writes are performed.',
    })
  } catch (error) {
    console.error('Arbiter game dry run error:', error)

    if (error instanceof ArbiterApiError) {
      return NextResponse.json(
        {
          ok: false,
          dryRun: true,
          writesPerformed: 0,
          error: error.message,
          arbiterStatus: error.status,
          details: error.details,
        },
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        dryRun: true,
        writesPerformed: 0,
        error: error instanceof Error ? error.message : 'Unknown Arbiter game dry run error',
      },
      { status: 500 }
    )
  }
}
