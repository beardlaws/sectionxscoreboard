// src/app/api/admin/arbiter-school-sync/route.ts

import { NextRequest, NextResponse } from 'next/server'

type Gender =
  | 'Boys'
  | 'Girls'
  | 'Coed'
  | null

type SeasonType =
  | 'Fall'
  | 'Winter'
  | 'Spring'
  | null

interface DiscoveredTeam {
  teamId: string
  entityId: string
  sportName: string | null
  teamLabel: string
  gender: Gender
  level: string | null
  isVarsity: boolean
  displayName: string
  sectionXSportName: string | null
  seasonType: SeasonType
  scheduleUrl: string
}

interface ScheduleRow {
  dateTime: string
  homeAway: string
  opponent: string
  location: string
  results: string
  status: string
  type: string
  raw: string
}

interface SyncedTeam extends DiscoveredTeam {
  success: boolean
  rowCount: number
  rows: ScheduleRow[]
  arbiterText: string
  error: string | null
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
}

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<img\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

function normalizeSchoolUrl(
  rawUrl: string
): {
  entityId: string
  url: string
} | null {
  try {
    const parsed = new URL(rawUrl)

    if (
      parsed.hostname !== 'arbiterlive.com' &&
      parsed.hostname !== 'www.arbiterlive.com'
    ) {
      return null
    }

    const entityId =
      parsed.searchParams.get('entityId') ||
      parsed.searchParams.get('activeEntityId')

    if (!entityId) {
      return null
    }

    return {
      entityId,
      url: `https://arbiterlive.com/Teams?entityId=${entityId}`,
    }
  } catch {
    return null
  }
}

function classifyGender(label: string): Gender {
  if (/^boys\b/i.test(label)) {
    return 'Boys'
  }

  if (/^girls\b/i.test(label)) {
    return 'Girls'
  }

  if (/\b(coed|co-ed|mixed)\b/i.test(label)) {
    return 'Coed'
  }

  return null
}

function classifyLevel(label: string): string | null {
  if (
    /\bjunior varsity\b/i.test(label) ||
    /\bjv\b/i.test(label)
  ) {
    return 'Junior Varsity'
  }

  if (/\bvarsity\b/i.test(label)) {
    return 'Varsity'
  }

  if (/\bmodified\b/i.test(label)) {
    return 'Modified'
  }

  const gradeMatch = label.match(
    /\b(\d+(?:\/\d+)*(?:\/\d+)?(?:th|st|nd|rd)?)\b/i
  )

  if (gradeMatch) {
    return gradeMatch[1]
  }

  return null
}

function looksLikeSportHeading(text: string): boolean {
  const cleaned = text.trim()

  if (!cleaned) {
    return false
  }

  if (
    /^(active teams|today'?s games|teams?|schedule|practice|roster|coaches?|season stats)$/i.test(
      cleaned
    )
  ) {
    return false
  }

  if (/^\d+\s+teams?$/i.test(cleaned)) {
    return false
  }

  if (cleaned.length > 60) {
    return false
  }

  return true
}

function inferSectionXSportName(
  sportName: string | null,
  gender: Gender
): string | null {
  if (!sportName) {
    return null
  }

  const sport = sportName.trim()

  const genderedSports = new Set([
    'Soccer',
    'Basketball',
    'Lacrosse',
  ])

  if (
    genderedSports.has(sport) &&
    (gender === 'Boys' || gender === 'Girls')
  ) {
    return `${gender} ${sport}`
  }

  return sport
}

function inferSeasonType(
  sportName: string | null
): SeasonType {
  if (!sportName) {
    return null
  }

  const sport = sportName
    .toLowerCase()
    .trim()

  /*
    IMPORTANT:
    Section X Girls Swimming is a FALL sport.

    Keep swimming here so Arbiter School Sync
    matches the sports table in Supabase.
  */
  const fallSports = [
    'football',
    'soccer',
    'volleyball',
    'cross country',
    'golf',
    'swimming',
  ]

  const winterSports = [
    'basketball',
    'hockey',
    'wrestling',
    'indoor track',
  ]

  const springSports = [
    'baseball',
    'softball',
    'lacrosse',
    'track',
  ]

  if (
    fallSports.some(name =>
      sport.includes(name)
    )
  ) {
    return 'Fall'
  }

  if (
    winterSports.some(name =>
      sport.includes(name)
    )
  ) {
    return 'Winter'
  }

  if (
    springSports.some(name =>
      sport.includes(name)
    )
  ) {
    return 'Spring'
  }

  return null
}

function discoverTeams(
  html: string,
  fallbackEntityId: string
): DiscoveredTeam[] {
  const discovered = new Map<
    string,
    DiscoveredTeam
  >()

  const tokenRegex =
    /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<a\b[^>]*href=["']([^"']*\/Teams\/Schedule\/(\d+)\?[^"']*activeEntityId=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi

  let currentSport: string | null = null
  let match: RegExpExecArray | null

  while (
    (match = tokenRegex.exec(html)) !== null
  ) {
    if (match[1]) {
      const headingText =
        stripHtml(match[2])

      if (
        looksLikeSportHeading(
          headingText
        )
      ) {
        currentSport = headingText
      }

      continue
    }

    const teamId = match[4]

    const entityId =
      match[5] ||
      fallbackEntityId

    const teamLabel =
      stripHtml(match[6]) ||
      `Arbiter Team ${teamId}`

    if (discovered.has(teamId)) {
      continue
    }

    const gender =
      classifyGender(teamLabel)

    const level =
      classifyLevel(teamLabel)

    const isVarsity =
      level === 'Varsity'

    const sectionXSportName =
      inferSectionXSportName(
        currentSport,
        gender
      )

    const seasonType =
      inferSeasonType(
        currentSport
      )

    const displayName = [
      gender,
      level,
      currentSport,
    ]
      .filter(Boolean)
      .join(' ')

    discovered.set(teamId, {
      teamId,
      entityId,
      sportName: currentSport,
      teamLabel,
      gender,
      level,
      isVarsity,
      displayName:
        displayName ||
        teamLabel,
      sectionXSportName,
      seasonType,
      scheduleUrl:
        `https://arbiterlive.com/Teams/Schedule/${teamId}?activeEntityId=${entityId}`,
    })
  }

  return Array.from(
    discovered.values()
  )
}

function extractCells(
  rowHtml: string
): string[] {
  const cells: string[] = []

  const cellRegex =
    /<td\b[^>]*>([\s\S]*?)<\/td>/gi

  let match: RegExpExecArray | null

  while (
    (match =
      cellRegex.exec(rowHtml)) !==
    null
  ) {
    cells.push(
      stripHtml(match[1])
    )
  }

  return cells
}

function findScheduleTable(
  html: string
): string | null {
  const tableRegex =
    /<table\b[^>]*>([\s\S]*?)<\/table>/gi

  let match: RegExpExecArray | null

  while (
    (match =
      tableRegex.exec(html)) !==
    null
  ) {
    const table = match[0]
    const text = stripHtml(table)

    if (
      /Date\/Time/i.test(text) &&
      /Opponent/i.test(text) &&
      /Location/i.test(text)
    ) {
      return table
    }
  }

  return null
}

function parseScheduleTable(
  tableHtml: string
): ScheduleRow[] {
  const rows: ScheduleRow[] = []

  const rowRegex =
    /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi

  let match: RegExpExecArray | null

  while (
    (match =
      rowRegex.exec(tableHtml)) !==
    null
  ) {
    const cells =
      extractCells(match[0])

    if (cells.length < 3) {
      continue
    }

    const dateTime =
      cells[0]?.trim() || ''

    if (
      !dateTime ||
      /Date\/Time/i.test(dateTime)
    ) {
      continue
    }

    if (
      !/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/i.test(
        dateTime
      )
    ) {
      continue
    }

    const homeAway =
      cells[1]?.trim() || ''

    const opponent =
      cells[2]?.trim() || ''

    const location =
      cells[3]?.trim() || ''

    const results =
      cells[4]?.trim() || ''

    const status =
      cells[5]?.trim() || ''

    const type =
      cells[6]?.trim() || ''

    const raw = [
      dateTime,
      homeAway,
      opponent,
      location,
      status,
      type,
    ]
      .filter(Boolean)
      .join('    ')

    rows.push({
      dateTime,
      homeAway,
      opponent,
      location,
      results,
      status,
      type,
      raw,
    })
  }

  return rows
}

function rowsToArbiterText(
  rows: ScheduleRow[]
): string {
  const header =
    'Date/Time    Home or Away    Opponent    Location    Results    Status    Type    Links'

  return [
    header,
    ...rows.map(
      row => row.raw
    ),
  ].join('\n')
}

async function fetchArbiterHtml(
  url: string
): Promise<string> {
  const response =
    await fetch(url, {
      method: 'GET',

      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; SectionXScoreboard/1.0)',

        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },

      cache: 'no-store',
    })

  if (!response.ok) {
    throw new Error(
      `Arbiter returned HTTP ${response.status}`
    )
  }

  return response.text()
}

async function syncTeam(
  team: DiscoveredTeam
): Promise<SyncedTeam> {
  try {
    const html =
      await fetchArbiterHtml(
        team.scheduleUrl
      )

    const table =
      findScheduleTable(html)

    if (!table) {
      return {
        ...team,
        success: false,
        rowCount: 0,
        rows: [],
        arbiterText: '',
        error:
          'Schedule table not found.',
      }
    }

    const rows =
      parseScheduleTable(table)

    return {
      ...team,
      success: true,
      rowCount: rows.length,
      rows,
      arbiterText:
        rowsToArbiterText(rows),
      error: null,
    }
  } catch (error: any) {
    return {
      ...team,
      success: false,
      rowCount: 0,
      rows: [],
      arbiterText: '',
      error:
        error?.message ||
        'Schedule fetch failed.',
    }
  }
}

export async function POST(
  req: NextRequest
) {
  try {
    const body = await req.json()

    const rawUrl =
      typeof body?.url ===
      'string'
        ? body.url.trim()
        : ''

    if (!rawUrl) {
      return NextResponse.json(
        {
          error:
            'An ArbiterLive school URL is required.',
        },
        {
          status: 400,
        }
      )
    }

    const normalized =
      normalizeSchoolUrl(rawUrl)

    if (!normalized) {
      return NextResponse.json(
        {
          error:
            'Please use a valid public ArbiterLive school URL.',
        },
        {
          status: 400,
        }
      )
    }

    const schoolHtml =
      await fetchArbiterHtml(
        normalized.url
      )

    const discovered =
      discoverTeams(
        schoolHtml,
        normalized.entityId
      )

    const varsityTeams =
      discovered.filter(
        team => team.isVarsity
      )

    const syncedTeams =
      await Promise.all(
        varsityTeams.map(
          team => syncTeam(team)
        )
      )

    const successful =
      syncedTeams.filter(
        team => team.success
      )

    const failed =
      syncedTeams.filter(
        team => !team.success
      )

    const totalRows =
      successful.reduce(
        (total, team) =>
          total + team.rowCount,
        0
      )

    const sports =
      Array.from(
        new Set(
          successful
            .map(
              team =>
                team.sectionXSportName
            )
            .filter(
              (
                value
              ): value is string =>
                !!value
            )
        )
      ).sort()

    const seasons =
      Array.from(
        new Set(
          successful
            .map(
              team =>
                team.seasonType
            )
            .filter(
              (
                value
              ): value is
                | 'Fall'
                | 'Winter'
                | 'Spring' =>
                !!value
            )
        )
      )

    return NextResponse.json({
      success: true,
      entityId:
        normalized.entityId,
      schoolUrl:
        normalized.url,
      discoveredTeams:
        discovered.length,
      varsityTeams:
        varsityTeams.length,
      schedulesFetched:
        successful.length,
      schedulesFailed:
        failed.length,
      totalRows,
      sports,
      seasons,
      teams: syncedTeams,
    })
  } catch (error: any) {
    console.error(
      'Arbiter school sync error:',
      error
    )

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Could not synchronize Arbiter school schedules.',
      },
      {
        status: 500,
      }
    )
  }
}
