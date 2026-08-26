import { NextRequest, NextResponse } from 'next/server'
import { ArbiterApiError, arbiterApi } from '@/lib/arbiter/client'

export const dynamic = 'force-dynamic'

const SECTION_X_SCHOOL_IDS = [
  2630, 52120, 3988, 4543, 4769, 6714, 8736, 9356, 9563, 9923, 9954, 13012,
  13569, 7896, 14077, 15195, 16678, 16935, 17532, 18479, 20233, 20061, 20146,
  23855,
]

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : value == null ? [] : [value]
}

function pick(obj: any, ...keys: string[]) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return null
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

export async function GET(req: NextRequest) {
  const now = new Date()
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 7, 1)).toISOString()
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), 10, 30, 23, 59, 59)).toISOString()

  const start = isoDate(req.nextUrl.searchParams.get('start'), defaultStart)
  const end = isoDate(req.nextUrl.searchParams.get('end'), defaultEnd)

  try {
    const raw = await arbiterApi.games({
      SchoolIds: SECTION_X_SCHOOL_IDS,
      GameStartDate: start,
      GameEndDate: end,
      IncludeDeletedGames: false,
      IncludePendingInformation: false,
    })

    const games = asArray(raw)
    const uniqueIds = new Set<number>()
    const duplicateIds = new Set<number>()
    const sportCounts = new Map<number, number>()
    const levelCounts = new Map<number, number>()
    const genderCounts = new Map<number, number>()
    const typeCounts = new Map<number, number>()
    const statusCounts = new Map<number, number>()
    let coOpGames = 0
    let missingUniqueGameId = 0
    let missingTeamIds = 0

    const normalized = games.map((game: any) => {
      const uniqueGameId = num(pick(game, 'uniqueGameId', 'uniqueGameID', 'UniqueGameId', 'UniqueGameID'))
      const sportId = num(pick(game, 'sportId', 'sportID', 'genericSportId', 'genericSportID', 'SportId'))
      const levelId = num(pick(game, 'levelId', 'levelID', 'genericLevelId', 'genericLevelID', 'LevelId'))
      const genderId = num(pick(game, 'genderId', 'genderID', 'GenderId'))
      const gameTypeId = num(pick(game, 'gameTypeId', 'gameTypeID', 'GameTypeId'))
      const gameStatusId = num(pick(game, 'gameStatusId', 'gameStatusID', 'GameStatusId'))
      const homeTeamId = num(pick(game, 'homeTeamId', 'homeTeamID', 'HomeTeamId', 'homeTeam'))
      const awayTeamId = num(pick(game, 'awayTeamId', 'awayTeamID', 'AwayTeamId', 'awayTeam'))
      const homeSchoolId = num(pick(game, 'homeSchoolId', 'homeSchoolID', 'HomeSchoolId'))
      const awaySchoolId = num(pick(game, 'awaySchoolId', 'awaySchoolID', 'AwaySchoolId'))
      const isCoOp = Boolean(pick(game, 'isCoOp', 'isCoop', 'IsCoOp'))

      if (uniqueGameId === null) missingUniqueGameId++
      else if (uniqueIds.has(uniqueGameId)) duplicateIds.add(uniqueGameId)
      else uniqueIds.add(uniqueGameId)

      if (homeTeamId === null || awayTeamId === null) missingTeamIds++
      if (isCoOp) coOpGames++

      if (sportId !== null) sportCounts.set(sportId, (sportCounts.get(sportId) || 0) + 1)
      if (levelId !== null) levelCounts.set(levelId, (levelCounts.get(levelId) || 0) + 1)
      if (genderId !== null) genderCounts.set(genderId, (genderCounts.get(genderId) || 0) + 1)
      if (gameTypeId !== null) typeCounts.set(gameTypeId, (typeCounts.get(gameTypeId) || 0) + 1)
      if (gameStatusId !== null) statusCounts.set(gameStatusId, (statusCounts.get(gameStatusId) || 0) + 1)

      return {
        uniqueGameId,
        startDate: pick(game, 'startDate', 'startDateTime', 'gameStartDate', 'StartDate'),
        lastModifiedDate: pick(game, 'lastModifiedDate', 'modifiedDate', 'LastModifiedDate'),
        sportId,
        levelId,
        genderId,
        gameTypeId,
        gameStatusId,
        homeTeamId,
        awayTeamId,
        homeSchoolId,
        awaySchoolId,
        siteId: num(pick(game, 'siteId', 'siteID', 'SiteId')),
        subSiteId: num(pick(game, 'subSiteId', 'subSiteID', 'SubSiteId')),
        isCoOp,
        raw: game,
      }
    })

    const counts = (map: Map<number, number>) =>
      Array.from(map.entries())
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      ok: true,
      dryRun: true,
      writesPerformed: 0,
      window: { start, end },
      summary: {
        gamesReturned: games.length,
        uniqueGameIds: uniqueIds.size,
        duplicateUniqueGameIds: duplicateIds.size,
        missingUniqueGameId,
        gamesMissingHomeOrAwayTeamId: missingTeamIds,
        coOpGames,
      },
      breakdowns: {
        sports: counts(sportCounts),
        levels: counts(levelCounts),
        genders: counts(genderCounts),
        gameTypes: counts(typeCounts),
        statuses: counts(statusCounts),
      },
      duplicateUniqueGameIds: Array.from(duplicateIds).slice(0, 100),
      sample: normalized.slice(0, 25),
      note: 'Read-only Arbiter feed probe. No Supabase writes are performed by this route.',
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
