// src/lib/parser.ts

import type {
  ParsedGameRow,
  GameStatus,
  ImportConfidence,
} from '@/types'
import { SCHOOL_ALIASES } from './constants'
import Fuse from 'fuse.js'

interface TeamRecord {
  id: string
  team_name: string
  school_name: string
  slug: string
  aliases: string[]
}

interface ParseOptions {
  teams: TeamRecord[]
  defaultDate?: string
  defaultSportId?: string
  defaultSeasonId?: string
}

interface ArbiterParseOptions extends ParseOptions {
  sourceTeamId: string
  year: number
}

/*
  Arbiter often uses official district names that differ from the
  display names used by Section X Scoreboard.

  These are parser-side aliases so Arbiter imports do not depend on
  every variation being present in constants.ts.

  IMPORTANT:
  An alias can only resolve to an internal team if that sport/team
  actually exists in options.teams. The parser will never invent a
  Section X team ID.
*/
const ARBITER_SCHOOL_ALIASES: Record<string, string> = {
  'Franklin Academy': 'Malone Central School',
  'Franklin Academy - Malone CSD': 'Malone Central School',
  'Franklin Academy - MCSD': 'Malone Central School',
  'Franklin Academy Malone CSD': 'Malone Central School',
  'Malone CSD': 'Malone Central School',
  'Massena Central School': 'Massena Central School',
  'Massena CSD': 'Massena Central School',
  'Ogdensburg Free Academy': 'Ogdensburg Free Academy',
  'St. Lawrence Central School': 'St Lawrence Central School',
  'St Lawrence Central School': 'St Lawrence Central School',
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.'’]/g, '')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getFuse(teams: TeamRecord[]): Fuse<TeamRecord> {
  /*
    Do NOT cache Fuse globally.

    School Sync parses different sports one after another. A cached
    Fuse instance from Boys Soccer must never be reused for Swimming,
    Basketball, etc.
  */
  return new Fuse(teams, {
    keys: ['team_name', 'school_name', 'aliases'],
    threshold: 0.4,
    includeScore: true,
  })
}

export function resetFuse() {
  /*
    Kept for compatibility with existing callers.
    Fuse is intentionally rebuilt for each match set.
  */
}

const DAY_NAMES =
  /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+/i

const MONTH_NAMES =
  /\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2}),?\s+(\d{4})/i

const SECTION_HEADER =
  /^(East|West|Central|North|South|Division|Non League|Non-League|Lisbon Tournament|Mudville Tournament|.*Tournament.*)/i

const MONTH_MAP: Record<string, string> = {
  JANUARY: '01',
  FEBRUARY: '02',
  MARCH: '03',
  APRIL: '04',
  MAY: '05',
  JUNE: '06',
  JULY: '07',
  AUGUST: '08',
  SEPTEMBER: '09',
  OCTOBER: '10',
  NOVEMBER: '11',
  DECEMBER: '12',

  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
}

function parseDateHeader(line: string): string | null {
  const dayStripped = line.replace(DAY_NAMES, '').trim()
  const match = dayStripped.match(MONTH_NAMES)

  if (!match) return null

  const month = MONTH_MAP[match[1].toUpperCase()]
  const day = match[2].padStart(2, '0')
  const year = match[3]

  return `${year}-${month}-${day}`
}

function isHeaderLine(line: string): boolean {
  if (DAY_NAMES.test(line)) return true

  if (
    SECTION_HEADER.test(line) &&
    !line.includes(',') &&
    !/\d+/.test(line.replace(/\d{1,2}:\d{2}/, ''))
  ) {
    return true
  }

  if (/^(End of|Copyright|Section X|N\.Y\.S\.|NEW YORK)/i.test(line)) {
    return true
  }

  if (/^SECTION X/i.test(line)) return true

  if (line.length < 4) return true

  return false
}

function getAliasMap(): Record<string, string> {
  return {
    ...SCHOOL_ALIASES,
    ...ARBITER_SCHOOL_ALIASES,
  }
}

function resolveTeamName(
  raw: string,
  teams: TeamRecord[]
): {
  id: string | null
  matched: string | null
  confidence: ImportConfidence
  note: string
} {
  const trimmed = raw.trim()

  if (!trimmed) {
    return {
      id: null,
      matched: null,
      confidence: 'Low',
      note: 'Empty team name',
    }
  }

  const aliasMap = getAliasMap()
  const normalizedInput = normalizeName(trimmed)

  /*
    1. Resolve known aliases first.
  */
  const aliasEntry = Object.entries(aliasMap).find(
    ([alias]) => normalizeName(alias) === normalizedInput
  )

  if (aliasEntry) {
    const resolvedName = aliasEntry[1]
    const resolvedNormalized = normalizeName(resolvedName)

    const found = teams.find(
      team =>
        normalizeName(team.school_name) === resolvedNormalized ||
        normalizeName(team.team_name) === resolvedNormalized
    )

    if (found) {
      return {
        id: found.id,
        matched: found.school_name,
        confidence: 'High',
        note: `Alias: ${trimmed}`,
      }
    }
  }

  /*
    2. Exact normalized match.
  */
  const exact = teams.find(
    team =>
      normalizeName(team.team_name) === normalizedInput ||
      normalizeName(team.school_name) === normalizedInput ||
      team.aliases.some(
        alias => normalizeName(alias) === normalizedInput
      )
  )

  if (exact) {
    return {
      id: exact.id,
      matched: exact.school_name,
      confidence: 'High',
      note: 'Exact match',
    }
  }

  /*
    3. Common Section X shorthand expansion.
  */
  const expanded = trimmed
    .replace(/^Madrid-Wadd\.$/i, 'Madrid-Waddington Central')
    .replace(/^Madrid-Wadd$/i, 'Madrid-Waddington Central')
    .replace(
      /^Parishville-Hopkinton$/i,
      'Parishville-Hopkinton Central School'
    )
    .replace(/^Hermon-DeKalb$/i, 'Hermon-Dekalb Central School')
    .replace(/^St\. Lawrence Central$/i, 'St Lawrence Central School')
    .replace(/^Ogdensburg$/i, 'Ogdensburg Free Academy')
    .replace(/^OFA$/i, 'Ogdensburg Free Academy')
    .replace(/^Norwood-Norfolk$/i, 'Norwood-Norfolk Central')
    .replace(/^Brushton-Moira$/i, 'Brushton-Moira Central School')
    .replace(/^Colton-Pierrepont$/i, 'Colton-Pierrepont Central School')
    .replace(/^Clifton-Fine$/i, 'Clifton-Fine Central School')
    .replace(/^Edwards-Knox$/i, 'Edwards-Knox Central School')
    .replace(/^Franklin Academy$/i, 'Malone Central School')
    .replace(/^Franklin Academy - Malone CSD$/i, 'Malone Central School')
    .replace(/^Franklin Academy - MCSD$/i, 'Malone Central School')
    .replace(/^Malone CSD$/i, 'Malone Central School')
    .replace(/^Massena CSD$/i, 'Massena Central School')

  if (normalizeName(expanded) !== normalizedInput) {
    const expandedNormalized = normalizeName(expanded)

    const expandedMatch = teams.find(
      team =>
        normalizeName(team.school_name) === expandedNormalized ||
        normalizeName(team.team_name) === expandedNormalized
    )

    if (expandedMatch) {
      return {
        id: expandedMatch.id,
        matched: expandedMatch.school_name,
        confidence: 'High',
        note: 'Expanded match',
      }
    }
  }

  /*
    4. Conservative partial match.
  */
  const partial = teams.find(team => {
    const school = normalizeName(team.school_name)
    const input = normalizedInput

    return (
      school.startsWith(input) ||
      input.startsWith(school) ||
      school.includes(input)
    )
  })

  if (partial) {
    return {
      id: partial.id,
      matched: partial.school_name,
      confidence: 'Medium',
      note: 'Partial match',
    }
  }

  /*
    5. Fuzzy match as the last internal-team attempt.
  */
  const fuse = getFuse(teams)
  const results = fuse.search(trimmed)

  if (
    results.length > 0 &&
    results[0].score !== undefined &&
    results[0].score < 0.45
  ) {
    return {
      id: results[0].item.id,
      matched: results[0].item.school_name,
      confidence:
        results[0].score < 0.25 ? 'High' : 'Medium',
      note: `Fuzzy match (score: ${results[0].score.toFixed(2)})`,
    }
  }

  return {
    id: null,
    matched: null,
    confidence: 'Low',
    note: `No match for "${trimmed}"`,
  }
}

function parseTime(str: string): string | null {
  const match = str.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i)
  return match ? match[0] : null
}

function parseDateFromLine(
  str: string,
  defaultDate?: string
): string | null {
  const slash = str.match(
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/
  )

  if (slash) {
    const year = slash[3]
      ? slash[3].length === 2
        ? `20${slash[3]}`
        : slash[3]
      : new Date().getFullYear().toString()

    return `${year}-${slash[1].padStart(
      2,
      '0'
    )}-${slash[2].padStart(2, '0')}`
  }

  const postponedTo = str.match(
    /to\s+(\d{1,2})\/(\d{1,2})/i
  )

  if (postponedTo) {
    const year = new Date().getFullYear()

    return `${year}-${postponedTo[1].padStart(
      2,
      '0'
    )}-${postponedTo[2].padStart(2, '0')}`
  }

  return defaultDate || null
}

export function parsePastedGames(
  text: string,
  options: ParseOptions
): ParsedGameRow[] {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  const results: ParsedGameRow[] = []
  let currentDate = options.defaultDate || null

  for (const line of lines) {
    const headerDate = parseDateHeader(line)

    if (headerDate) {
      currentDate = headerDate
      continue
    }

    if (isHeaderLine(line)) continue

    const row = parseSingleLine(line, {
      ...options,
      defaultDate: currentDate || options.defaultDate,
    })

    results.push(row)
  }

  return results
}

function parseSingleLine(
  line: string,
  options: ParseOptions
): ParsedGameRow {
  const id = Math.random().toString(36).slice(2)
  const confidenceNotes: string[] = []

  let status: GameStatus = 'Scheduled'
  let homeScore: number | null = null
  let awayScore: number | null = null
  let rescheduledDate: string | null = null
  let gameNumber: number | null = null
  let neutralSite = false
  let eventName: string | null = null
  let gameTime: string | null = null

  let working = line

  const bracketMatch = working.match(/\[([^\]]+)\]/)

  if (bracketMatch) {
    eventName = bracketMatch[1]
    working = working.replace(bracketMatch[0], '').trim()
  }

  if (/neutral\s*site/i.test(working)) {
    neutralSite = true
    working = working.replace(/neutral\s*site/gi, '').trim()
  }

  const doubleheaderMatch =
    working.match(/\((\d+)(?:st|nd|rd|th)?\s*game\)/i) ||
    working.match(/\((\d+)(?:st|nd|rd|th)\)/i)

  if (doubleheaderMatch) {
    gameNumber = parseInt(doubleheaderMatch[1], 10)
    working = working.replace(doubleheaderMatch[0], '').trim()
  }

  if (/\bfinal\b/i.test(working)) {
    status = 'Final'
    working = working.replace(/\bfinal\b/gi, '').trim()
  } else if (/\bppd\.?\s+to\s+([\d/]+)/i.test(working)) {
    const rescheduleMatch = working.match(
      /\bppd\.?\s+to\s+([\d/]+)/i
    )

    if (rescheduleMatch) {
      rescheduledDate = parseDateFromLine(rescheduleMatch[1])
    }

    status = 'Postponed'
    working = working
      .replace(/\bppd\.?\s+to\s+[\d/]+/gi, '')
      .trim()
  } else if (/\bppd\b|\bpostponed\b/i.test(working)) {
    status = 'Postponed'
    working = working
      .replace(/\b(ppd\.?|postponed)\b/gi, '')
      .trim()
  } else if (/\bcanceled\b|\bcancelled\b/i.test(working)) {
    status = 'Canceled'
    working = working
      .replace(/\b(canceled|cancelled)\b/gi, '')
      .trim()
  } else if (
    /\bsickness\b|\bweather\b|\bfield conditions\b/i.test(working)
  ) {
    status = 'Postponed'
    working = working
      .replace(/\b(sickness|weather|field conditions)\b/gi, '')
      .trim()
  }

  gameTime = parseTime(working)

  if (gameTime) {
    working = working.replace(gameTime, '').trim()
  }

  const gameDate = parseDateFromLine(
    working,
    options.defaultDate
  )

  if (
    gameDate &&
    options.defaultDate &&
    gameDate !== options.defaultDate
  ) {
    working = working
      .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, '')
      .trim()
  }

  working = working
    .replace(/,\s*$/, '')
    .replace(/^\s*,/, '')
    .trim()

  let homeTeamName: string | null = null
  let awayTeamName: string | null = null

  const atPattern = working.match(
    /^(.+?)\s+at\s+(.+?)(?:\s+(\d+)[-,\s]+(\d+))?$/i
  )

  if (atPattern) {
    awayTeamName = atPattern[1].trim()

    let homePart = atPattern[2].trim()

    homePart = homePart
      .replace(/\s+\d{1,2}:\d{2}\s*(am|pm)?$/i, '')
      .trim()

    homeTeamName = homePart

    if (atPattern[3] && atPattern[4]) {
      awayScore = parseInt(atPattern[3], 10)
      homeScore = parseInt(atPattern[4], 10)

      if (status === 'Scheduled') {
        status = 'Final'
      }
    }
  } else {
    const scorePattern = working.match(
      /^(.+?)\s+(\d+)[,\s]+(.+?)\s+(\d+)\s*$/
    )

    if (scorePattern) {
      awayTeamName = scorePattern[1].trim()
      awayScore = parseInt(scorePattern[2], 10)
      homeTeamName = scorePattern[3].trim()
      homeScore = parseInt(scorePattern[4], 10)

      if (status === 'Scheduled') {
        status = 'Final'
      }
    } else {
      const vsPattern = working.match(
        /^(.+?)\s+(?:vs\.?)\s+(.+)$/i
      )

      if (vsPattern) {
        awayTeamName = vsPattern[1].trim()
        homeTeamName = vsPattern[2].trim()
      } else if (working.includes(',')) {
        const parts = working
          .split(',')
          .map(part => part.trim())
          .filter(Boolean)

        if (parts.length >= 2) {
          awayTeamName = parts[0]
          homeTeamName = parts[1]
        } else {
          confidenceNotes.push(
            `Could not parse: "${working}"`
          )
        }
      } else {
        confidenceNotes.push(
          `Could not parse: "${working}"`
        )
      }
    }
  }

  if (homeTeamName) {
    homeTeamName = homeTeamName
      .replace(/\s*\d+$/, '')
      .trim()
  }

  if (awayTeamName) {
    awayTeamName = awayTeamName
      .replace(/\s*\d+$/, '')
      .trim()
  }

  let homeTeamId: string | null = null
  let awayTeamId: string | null = null
  let homeTeamMatch: string | null = null
  let awayTeamMatch: string | null = null
  let externalHomeName: string | null = null
  let externalAwayName: string | null = null
  let confidence: ImportConfidence = 'High'

  if (homeTeamName && options.teams.length > 0) {
    const result = resolveTeamName(homeTeamName, options.teams)

    homeTeamId = result.id
    homeTeamMatch = result.matched

    if (result.confidence === 'Low') {
      externalHomeName = homeTeamName
    } else if (result.confidence === 'Medium') {
      confidence = 'Medium'
    }

    confidenceNotes.push(`Home: ${result.note}`)
  }

  if (awayTeamName && options.teams.length > 0) {
    const result = resolveTeamName(awayTeamName, options.teams)

    awayTeamId = result.id
    awayTeamMatch = result.matched

    if (result.confidence === 'Low') {
      externalAwayName = awayTeamName
    } else if (
      result.confidence === 'Medium' &&
      confidence === 'High'
    ) {
      confidence = 'Medium'
    }

    confidenceNotes.push(`Away: ${result.note}`)
  }

  const homeResolved = !!homeTeamId
  const awayResolved = !!awayTeamId

  if (!homeTeamName || !awayTeamName) {
    confidence = 'Low'
  } else if (homeResolved !== awayResolved) {
    confidence = 'Medium'
    confidenceNotes.push('Non-league game vs external opponent')
  } else if (!homeResolved && !awayResolved) {
    confidence = 'Low'
  }

  return {
    id,
    raw: line,
    game_date: gameDate,
    game_time: gameTime,
    home_team_name: homeTeamName,
    away_team_name: awayTeamName,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    home_team_match:
      homeTeamMatch ||
      (externalHomeName ? `[EXT] ${externalHomeName}` : null),
    away_team_match:
      awayTeamMatch ||
      (externalAwayName ? `[EXT] ${externalAwayName}` : null),
    external_home_name: externalHomeName,
    external_away_name: externalAwayName,
    home_score: homeScore,
    away_score: awayScore,
    status,
    location: null,
    notes: null,
    rescheduled_date: rescheduledDate,
    game_number: gameNumber,
    neutral_site: neutralSite,
    event_name: eventName,
    confidence,
    confidence_notes: confidenceNotes,
    duplicate_warning: false,
    approved: confidence !== 'Low',
    error: null,
    sport_id: options.defaultSportId || null,
  }
}

function cleanArbiterText(text: string): string {
  let cleaned = text
    .replace(/\u00a0/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  cleaned = cleaned.replace(
    /Date\/Time\s+(?:Home or Away\s+)?Opponent\s+Location\s+Results(?:\s+Status)?\s+Type\s+Links\s*/i,
    ''
  )

  const firstGameIndex = cleaned.search(
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{1,2}:\d{2}\s+(?:AM|PM)\b/i
  )

  if (firstGameIndex > 0) {
    cleaned = cleaned.slice(firstGameIndex)
  }

  return cleaned.trim()
}

function getTeamSearchNames(team: TeamRecord): string[] {
  const aliasMap = getAliasMap()

  const constantAliases = Object.entries(aliasMap)
    .filter(
      ([, resolvedName]) =>
        normalizeName(resolvedName) === normalizeName(team.school_name)
    )
    .map(([alias]) => alias)

  return Array.from(
    new Set([
      team.school_name,
      team.team_name,
      ...team.aliases,
      ...constantAliases,
    ])
  )
    .filter(Boolean)
    .map(name => name.trim())
    .filter(Boolean)
}

function findInternalOpponentFromTail(
  tail: string,
  teams: TeamRecord[],
  sourceTeamId: string
): {
  team: TeamRecord
  opponentText: string
  locationText: string | null
} | null {
  const lowerTail = normalizeName(tail)

  const candidates: {
    team: TeamRecord
    searchName: string
  }[] = []

  for (const team of teams) {
    if (team.id === sourceTeamId) continue

    for (const searchName of getTeamSearchNames(team)) {
      candidates.push({
        team,
        searchName,
      })
    }
  }

  /*
    Longest alias first prevents "Franklin Academy" from winning before
    "Franklin Academy - Malone CSD".
  */
  candidates.sort(
    (a, b) => b.searchName.length - a.searchName.length
  )

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeName(candidate.searchName)

    if (lowerTail.startsWith(normalizedCandidate)) {
      /*
        Use the original text length when possible. If punctuation
        normalization changed the exact character count, fall back to
        a case-insensitive raw prefix lookup.
      */
      const rawLower = tail.toLowerCase()
      const searchLower = candidate.searchName.toLowerCase()

      let consumed = candidate.searchName.length

      if (!rawLower.startsWith(searchLower)) {
        const aliasPattern = candidate.searchName
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\s*-\s*/g, '\\s*-\\s*')
          .replace(/\./g, '\\.?')

        const rawMatch = tail.match(
          new RegExp(`^${aliasPattern}`, 'i')
        )

        if (rawMatch) {
          consumed = rawMatch[0].length
        }
      }

      const opponentText = tail.slice(0, consumed).trim()
      const locationText = tail.slice(consumed).trim() || null

      return {
        team: candidate.team,
        opponentText,
        locationText,
      }
    }
  }

  return null
}

function splitExternalOpponent(
  tail: string,
  sourceTeam: TeamRecord,
  direction: '@' | 'vs'
): {
  opponent: string
  location: string | null
} {
  const working = tail
    .replace(/\s+with\s+\d+\s+others?\b/i, '')
    .trim()

  if (direction === 'vs') {
    const sourceNames = getTeamSearchNames(sourceTeam).sort(
      (a, b) => b.length - a.length
    )

    for (const sourceName of sourceNames) {
      const index = working
        .toLowerCase()
        .indexOf(sourceName.toLowerCase())

      if (index > 0) {
        return {
          opponent: working.slice(0, index).trim(),
          location: working.slice(index).trim() || null,
        }
      }
    }
  }

  const schoolEnding = working.match(
    /^(.+?(?:Central High School|Central School|High School|Junior Senior High School|Junior\/Senior High School|Jr\.?\s*\/?\s*Sr\.?\s*High School|Academy|School District|CSD))\b\s*(.*)$/i
  )

  if (schoolEnding) {
    return {
      opponent: schoolEnding[1].trim(),
      location: schoolEnding[2].trim() || null,
    }
  }

  return {
    opponent: working,
    location: null,
  }
}

function createLowConfidenceArbiterRow(
  raw: string,
  message: string,
  sportId?: string
): ParsedGameRow {
  return {
    id: Math.random().toString(36).slice(2),
    raw,
    game_date: null,
    game_time: null,
    home_team_name: null,
    away_team_name: null,
    home_team_id: null,
    away_team_id: null,
    home_team_match: null,
    away_team_match: null,
    external_home_name: null,
    external_away_name: null,
    home_score: null,
    away_score: null,
    status: 'Scheduled',
    location: null,
    notes: null,
    rescheduled_date: null,
    game_number: null,
    neutral_site: false,
    event_name: null,
    confidence: 'Low',
    confidence_notes: [message],
    duplicate_warning: false,
    approved: false,
    error: message,
    sport_id: sportId || null,
  }
}

export function parseArbiterSchedule(
  text: string,
  options: ArbiterParseOptions
): ParsedGameRow[] {
  const sourceTeam = options.teams.find(
    team => team.id === options.sourceTeamId
  )

  if (!sourceTeam) {
    return [
      createLowConfidenceArbiterRow(
        text,
        'Could not find the selected schedule team',
        options.defaultSportId
      ),
    ]
  }

  const cleaned = cleanArbiterText(text)

  const chunks = cleaned
    .split(
      /(?=\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{1,2}:\d{2}\s+(?:AM|PM)\b)/i
    )
    .map(chunk => chunk.trim())
    .filter(Boolean)

  const results: ParsedGameRow[] = []

  for (const chunk of chunks) {
    const match = chunk.match(
      /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{1,2}:\d{2}\s+(?:AM|PM))\s+(@|vs)\s+(.+)$/i
    )

    if (!match) {
      results.push(
        createLowConfidenceArbiterRow(
          chunk,
          'Could not parse Arbiter date, time, or home/away format',
          options.defaultSportId
        )
      )
      continue
    }

    const month = MONTH_MAP[match[1].toUpperCase()]
    const day = match[2].padStart(2, '0')
    const gameDate = `${options.year}-${month}-${day}`
    const gameTime = match[3]

    const direction = match[4].toLowerCase() as '@' | 'vs'

    let tail = match[5]
      .replace(/^Opponent\s+logo\s+/i, '')
      .trim()

    let arbiterType:
      | 'League'
      | 'Non-League'
      | 'Scrimmage'
      | null = null

    const typeMatch = tail.match(/\s+([LNS])\s*$/)

    if (typeMatch) {
      const typeCode = typeMatch[1].toUpperCase()

      if (typeCode === 'L') {
        arbiterType = 'League'
      } else if (typeCode === 'N') {
        arbiterType = 'Non-League'
      } else if (typeCode === 'S') {
        arbiterType = 'Scrimmage'
      }

      tail = tail.slice(0, typeMatch.index).trim()
    }

    let status: GameStatus = 'Scheduled'

    if (/\b(?:Canceled|Cancelled)\b/i.test(tail)) {
      status = 'Canceled'
      tail = tail
        .replace(/\b(?:Canceled|Cancelled)\b/gi, '')
        .trim()
    } else if (/\b(?:Postponed|PPD)\b/i.test(tail)) {
      status = 'Postponed'
      tail = tail
        .replace(/\b(?:Postponed|PPD)\b/gi, '')
        .trim()
    }

    const multiTeamMatch =
      tail.match(/\s+with\s+(\d+)\s+others?\b/i)

    const additionalOpponentCount =
      multiTeamMatch
        ? parseInt(multiTeamMatch[1], 10)
        : null

    if (multiTeamMatch) {
      tail = tail
        .replace(/\s+with\s+\d+\s+others?\b/gi, '')
        .trim()
    }

    let opponentName = ''
    let location: string | null = null
    let opponentTeam: TeamRecord | null = null

    const internal = findInternalOpponentFromTail(
      tail,
      options.teams,
      options.sourceTeamId
    )

    if (internal) {
      opponentTeam = internal.team
      opponentName = internal.opponentText
      location = internal.locationText
    } else {
      const external = splitExternalOpponent(
        tail,
        sourceTeam,
        direction
      )

      opponentName = external.opponent
      location = external.location
    }

    opponentName = opponentName
      .replace(/\s+with\s+\d+\s+others?\b/gi, '')
      .trim()

    if (!opponentName) {
      results.push(
        createLowConfidenceArbiterRow(
          chunk,
          'Could not determine opponent',
          options.defaultSportId
        )
      )
      continue
    }

    const opponentTeamId = opponentTeam?.id || null
    const opponentDisplay =
      opponentTeam?.school_name || opponentName

    let homeTeamName: string
    let awayTeamName: string
    let homeTeamId: string | null
    let awayTeamId: string | null
    let homeTeamMatch: string | null
    let awayTeamMatch: string | null
    let externalHomeName: string | null = null
    let externalAwayName: string | null = null

    if (direction === 'vs') {
      homeTeamName = sourceTeam.school_name
      awayTeamName = opponentName
      homeTeamId = sourceTeam.id
      awayTeamId = opponentTeamId
      homeTeamMatch = sourceTeam.school_name
      awayTeamMatch = opponentTeam
        ? opponentDisplay
        : `[EXT] ${opponentName}`

      if (!opponentTeam) {
        externalAwayName = opponentName
      }
    } else {
      homeTeamName = opponentName
      awayTeamName = sourceTeam.school_name
      homeTeamId = opponentTeamId
      awayTeamId = sourceTeam.id
      homeTeamMatch = opponentTeam
        ? opponentDisplay
        : `[EXT] ${opponentName}`
      awayTeamMatch = sourceTeam.school_name

      if (!opponentTeam) {
        externalHomeName = opponentName
      }
    }

    const confidence: ImportConfidence =
      additionalOpponentCount !== null
        ? 'Medium'
        : opponentTeam
          ? 'High'
          : 'Medium'

    const confidenceNotes: string[] = [
      direction === 'vs'
        ? 'Arbiter home game'
        : 'Arbiter away game',
      opponentTeam
        ? `Opponent matched: ${opponentDisplay}`
        : `External opponent: ${opponentName}`,
    ]

    if (additionalOpponentCount !== null) {
      confidenceNotes.push(
        `Multi-team Arbiter event: ${additionalOpponentCount} additional opponent${
          additionalOpponentCount === 1 ? '' : 's'
        }. Review before publishing.`
      )
    }

    if (status !== 'Scheduled') {
      confidenceNotes.push(`Status: ${status}`)
    }

    if (arbiterType) {
      confidenceNotes.push(`Type: ${arbiterType}`)
    }

    if (location) {
      confidenceNotes.push(`Location: ${location}`)
    }

    results.push({
      id: Math.random().toString(36).slice(2),
      raw: chunk,
      game_date: gameDate,
      game_time: gameTime,
      home_team_name: homeTeamName,
      away_team_name: awayTeamName,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_team_match: homeTeamMatch,
      away_team_match: awayTeamMatch,
      external_home_name: externalHomeName,
      external_away_name: externalAwayName,
      home_score: null,
      away_score: null,
      status,
      location,
      notes:
        [
          arbiterType
            ? `Arbiter type: ${arbiterType}`
            : null,
          additionalOpponentCount !== null
            ? `Multi-team Arbiter event with ${additionalOpponentCount} additional opponent${
                additionalOpponentCount === 1 ? '' : 's'
              }`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || null,
      rescheduled_date: null,
      game_number: null,
      neutral_site: false,
      event_name:
        additionalOpponentCount !== null
          ? 'Multi-team event'
          : null,
      confidence,
      confidence_notes: confidenceNotes,
      duplicate_warning: false,
      approved: additionalOpponentCount === null,
      error: null,
      sport_id: options.defaultSportId || null,
    })
  }

  return results
}

export function parseCSV(
  text: string
): Record<string, string>[] {
  const lines = text.split('\n').filter(Boolean)

  if (lines.length < 2) {
    return []
  }

  const headers = lines[0]
    .split(',')
    .map(header =>
      header
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
    )

  return lines.slice(1).map(line => {
    const values = line
      .split(',')
      .map(value => value.trim())

    const row: Record<string, string> = {}

    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })

    return row
  })
}
