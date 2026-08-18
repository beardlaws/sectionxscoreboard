// src/lib/parser.ts
import type { ParsedGameRow, GameStatus, ImportConfidence } from '@/types'
import { SCHOOL_ALIASES } from './constants'
import Fuse from 'fuse.js'

interface TeamRecord {
  id: string
  team_name: string
  school_name: string
  slug: string
  aliases: string[]
}

let fuseInstance: Fuse<TeamRecord> | null = null

function getFuse(teams: TeamRecord[]): Fuse<TeamRecord> {
  if (!fuseInstance) {
    fuseInstance = new Fuse(teams, {
      keys: ['team_name', 'school_name', 'aliases'],
      threshold: 0.4,
      includeScore: true,
    })
  }
  return fuseInstance
}

export function resetFuse() {
  fuseInstance = null
}

// Day/month name patterns for header detection
const DAY_NAMES = /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+/i
const MONTH_NAMES = /\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2}),?\s+(\d{4})/i
const MONTH_SHORT = /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})/i
const SECTION_HEADER = /^(East|West|Central|North|South|Division|Non League|Non-League|Lisbon Tournament|Mudville Tournament|.*Tournament.*)/i

const MONTH_MAP: Record<string, string> = {
  JANUARY: '01', FEBRUARY: '02', MARCH: '03', APRIL: '04', MAY: '05', JUNE: '06',
  JULY: '07', AUGUST: '08', SEPTEMBER: '09', OCTOBER: '10', NOVEMBER: '11', DECEMBER: '12',
  JAN: '01', FEB: '02', MAR: '03', APR: '04', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
}

function parseDateHeader(line: string): string | null {
  // "TUESDAY, APRIL 14, 2026" or "FRIDAY, APRIL 17, 2026"
  const dayStripped = line.replace(DAY_NAMES, '').trim()
  const m = dayStripped.match(MONTH_NAMES)
  if (m) {
    const month = MONTH_MAP[m[1].toUpperCase()]
    const day = m[2].padStart(2, '0')
    const year = m[3]
    return `${year}-${month}-${day}`
  }
  return null
}

function isHeaderLine(line: string): boolean {
  // Skip day header lines, section/division headers, blank-ish lines
  if (DAY_NAMES.test(line)) return true
  if (SECTION_HEADER.test(line) && !line.includes(',') && !/\d+/.test(line.replace(/\d{1,2}:\d{2}/, ''))) return true
  if (/^(End of|Copyright|Section X|N\.Y\.S\.|NEW YORK)/i.test(line)) return true
  if (/^SECTION X/i.test(line)) return true
  if (line.length < 4) return true
  return false
}

function resolveTeamName(raw: string, teams: TeamRecord[]): {
  id: string | null
  matched: string | null
  confidence: ImportConfidence
  note: string
} {
  const trimmed = raw.trim()
  if (!trimmed) return { id: null, matched: null, confidence: 'Low', note: 'Empty team name' }

  // Exact school alias match (case-insensitive)
  const aliasKey = Object.keys(SCHOOL_ALIASES).find(k => k.toLowerCase() === trimmed.toLowerCase())
  if (aliasKey) {
    const aliasResolved = SCHOOL_ALIASES[aliasKey]
    const found = teams.find(t => t.school_name.toLowerCase() === aliasResolved.toLowerCase())
    if (found) return { id: found.id, matched: found.school_name, confidence: 'High', note: `Alias: ${trimmed}` }
  }

  // Exact match
  const exact = teams.find(t =>
    t.team_name.toLowerCase() === trimmed.toLowerCase() ||
    t.school_name.toLowerCase() === trimmed.toLowerCase()
  )
  if (exact) return { id: exact.id, matched: exact.school_name, confidence: 'High', note: 'Exact match' }

  // Abbreviation expansions for common short forms
  const expanded = trimmed
    .replace(/^Madrid-Wadd\.$/, 'Madrid-Waddington Central')
    .replace(/^Madrid-Wadd$/, 'Madrid-Waddington Central')
    .replace(/^Parishville-Hopkinton$/, 'Parishville-Hopkinton Central School')
    .replace(/^Hermon-DeKalb$/, 'Hermon-Dekalb Central School')
    .replace(/^St\. Lawrence Central$/, 'St Lawrence Central School')
    .replace(/^Ogdensburg$/, 'Ogdensburg Free Academy')
    .replace(/^Norwood-Norfolk$/, 'Norwood-Norfolk Central')
    .replace(/^Brushton-Moira$/, 'Brushton-Moira Central School')
    .replace(/^Colton-Pierrepont$/, 'Colton-Pierrepont Central School')
    .replace(/^Clifton-Fine$/, 'Clifton-Fine Central School')
    .replace(/^Edwards-Knox$/, 'Edwards-Knox Central School')

  if (expanded !== trimmed) {
    const expandedMatch = teams.find(t => t.school_name.toLowerCase() === expanded.toLowerCase())
    if (expandedMatch) return { id: expandedMatch.id, matched: expandedMatch.school_name, confidence: 'High', note: 'Expanded match' }
  }

  // Partial: school name contains trimmed or vice versa
  const partial = teams.find(t =>
    t.school_name.toLowerCase().startsWith(trimmed.toLowerCase()) ||
    trimmed.toLowerCase().startsWith(t.school_name.toLowerCase().split(' ')[0].toLowerCase()) ||
    t.school_name.toLowerCase().includes(trimmed.toLowerCase())
  )
  if (partial) return { id: partial.id, matched: partial.school_name, confidence: 'Medium', note: 'Partial match' }

  // Fuzzy
  const fuse = getFuse(teams)
  const results = fuse.search(trimmed)
  if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.45) {
    return {
      id: results[0].item.id,
      matched: results[0].item.school_name,
      confidence: results[0].score < 0.25 ? 'High' : 'Medium',
      note: `Fuzzy match (score: ${results[0].score?.toFixed(2)})`
    }
  }

  return { id: null, matched: null, confidence: 'Low', note: `No match for "${trimmed}"` }
}

function parseTime(str: string): string | null {
  const m = str.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i)
  return m ? m[0] : null
}

function parseDateFromLine(str: string, defaultDate?: string): string | null {
  // mm/dd or mm/dd/yyyy
  const slash = str.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
  if (slash) {
    const year = slash[3] ? (slash[3].length === 2 ? '20' + slash[3] : slash[3]) : new Date().getFullYear().toString()
    return `${year}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`
  }
  // "ppd. to 4/18" style
  const ppdTo = str.match(/to\s+(\d{1,2})\/(\d{1,2})/i)
  if (ppdTo) {
    const year = new Date().getFullYear()
    return `${year}-${ppdTo[1].padStart(2, '0')}-${ppdTo[2].padStart(2, '0')}`
  }
  return defaultDate || null
}

interface ParseOptions {
  teams: TeamRecord[]
  defaultDate?: string
  defaultSportId?: string
  defaultSeasonId?: string
}

export function parsePastedGames(text: string, options: ParseOptions): ParsedGameRow[] {
  // Reset fuse so it uses fresh team data
  fuseInstance = null

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const results: ParsedGameRow[] = []
  let currentDate = options.defaultDate || null

  for (const line of lines) {
    // Check if this line is a date header like "TUESDAY, APRIL 14, 2026"
    const headerDate = parseDateHeader(line)
    if (headerDate) {
      currentDate = headerDate
      continue
    }

    // Skip section/division headers and other non-game lines
    if (isHeaderLine(line)) continue

    const row = parseSingleLine(line, { ...options, defaultDate: currentDate || options.defaultDate })
    results.push(row)
  }

  return results
}

function parseSingleLine(line: string, options: ParseOptions): ParsedGameRow {
  const id = Math.random().toString(36).slice(2)
  const notes: string[] = []
  let status: GameStatus = 'Scheduled'
  let home_score: number | null = null
  let away_score: number | null = null
  let rescheduled_date: string | null = null
  let game_number: number | null = null
  let neutral_site = false
  let event_name: string | null = null
  let game_time: string | null = null

  let working = line

  // Tournament/event name in brackets
  const bracketMatch = working.match(/\[([^\]]+)\]/)
  if (bracketMatch) {
    event_name = bracketMatch[1]
    working = working.replace(bracketMatch[0], '').trim()
  }

  // Neutral site
  if (/neutral\s*site/i.test(working)) {
    neutral_site = true
    working = working.replace(/neutral\s*site/gi, '').trim()
  }

  // Doubleheader game number: (1st game), (2nd game), (1), (2)
  const dblMatch = working.match(/\((\d+)(?:st|nd|rd|th)?\s*game\)/i) || working.match(/\((\d+)(?:st|nd|rd|th)\)/i)
  if (dblMatch) {
    game_number = parseInt(dblMatch[1])
    working = working.replace(dblMatch[0], '').trim()
  }

  // Status keywords
  if (/\bfinal\b/i.test(working)) {
    status = 'Final'
    working = working.replace(/\bfinal\b/gi, '').trim()
  } else if (/\bppd\.?\s+to\s+([\d/]+)/i.test(working)) {
    const rdMatch = working.match(/\bppd\.?\s+to\s+([\d/]+)/i)
    if (rdMatch) rescheduled_date = parseDateFromLine(rdMatch[1])
    status = 'Postponed'
    working = working.replace(/\bppd\.?\s+to\s+[\d/]+/gi, '').trim()
  } else if (/\bppd\b|\bpostponed\b/i.test(working)) {
    status = 'Postponed'
    working = working.replace(/\b(ppd\.?|postponed)\b/gi, '').trim()
  } else if (/\bcanceled\b|\bcancelled\b/i.test(working)) {
    status = 'Canceled'
    working = working.replace(/\b(canceled|cancelled)\b/gi, '').trim()
  } else if (/\bsickness\b|\bweather\b|\bfield conditions\b/i.test(working)) {
    // "ppd. sickness" etc
    status = 'Postponed'
    working = working.replace(/\b(sickness|weather|field conditions)\b/gi, '').trim()
  }

  // Time: 4:30, 3:30, 10:00, etc.
  game_time = parseTime(working)
  if (game_time) {
    working = working.replace(game_time, '').trim()
  }

  // Date in line (e.g. "ppd. to 4/18" already handled above, but handle inline dates)
  const game_date = parseDateFromLine(working, options.defaultDate)
  if (game_date && options.defaultDate && game_date !== options.defaultDate) {
    // Only remove date if it's explicit in this line
    working = working.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, '').trim()
  }

  // Clean trailing commas and punctuation
  working = working.replace(/,\s*$/, '').replace(/^\s*,/, '').trim()

  let home_team_name: string | null = null
  let away_team_name: string | null = null

  // Pattern: "Away at Home" (scheduled game)
  const atPattern = working.match(/^(.+?)\s+at\s+(.+?)(?:\s+(\d+)[-,\s]+(\d+))?$/i)
  if (atPattern) {
    away_team_name = atPattern[1].trim()
    let homePart = atPattern[2].trim()
    // Remove trailing time if still attached
    homePart = homePart.replace(/\s+\d{1,2}:\d{2}\s*(am|pm)?$/i, '').trim()
    home_team_name = homePart
    if (atPattern[3] && atPattern[4]) {
      away_score = parseInt(atPattern[3])
      home_score = parseInt(atPattern[4])
      if (status === 'Scheduled') status = 'Final'
    }
  } else {
    // Pattern: "Away N, Home M" — standard score line
    const scorePattern = working.match(/^(.+?)\s+(\d+)[,\s]+(.+?)\s+(\d+)\s*$/)
    if (scorePattern) {
      away_team_name = scorePattern[1].trim()
      away_score = parseInt(scorePattern[2])
      home_team_name = scorePattern[3].trim()
      home_score = parseInt(scorePattern[4])
      if (status === 'Scheduled') status = 'Final'
    } else {
      // vs. pattern
      const vsPattern = working.match(/^(.+?)\s+(?:vs\.?)\s+(.+)$/i)
      if (vsPattern) {
        away_team_name = vsPattern[1].trim()
        home_team_name = vsPattern[2].trim()
      } else if (working.includes(',')) {
        const parts = working.split(',').map(p => p.trim()).filter(Boolean)
        if (parts.length >= 2) {
          away_team_name = parts[0]
          home_team_name = parts[1]
        } else {
          notes.push(`Could not parse: "${working}"`)
        }
      } else {
        notes.push(`Could not parse: "${working}"`)
      }
    }
  }

  // Clean stray score digits from team names
  if (home_team_name) home_team_name = home_team_name.replace(/\s*\d+$/, '').trim()
  if (away_team_name) away_team_name = away_team_name.replace(/\s*\d+$/, '').trim()

  // Resolve teams
  let home_team_id: string | null = null
  let away_team_id: string | null = null
  let home_team_match: string | null = null
  let away_team_match: string | null = null
  let confidence: ImportConfidence = 'High'

  let external_home_name: string | null = null
  let external_away_name: string | null = null

  if (home_team_name && options.teams.length > 0) {
    const res = resolveTeamName(home_team_name, options.teams)
    home_team_id = res.id
    home_team_match = res.matched
    if (res.confidence === 'Low') {
      external_home_name = home_team_name
    } else if (res.confidence === 'Medium' && confidence === 'High') {
      confidence = 'Medium'
    }
    notes.push(`Home: ${res.note}`)
  }

  if (away_team_name && options.teams.length > 0) {
    const res = resolveTeamName(away_team_name, options.teams)
    away_team_id = res.id
    away_team_match = res.matched
    if (res.confidence === 'Low') {
      external_away_name = away_team_name
    } else if (res.confidence === 'Medium' && confidence === 'High') {
      confidence = 'Medium'
    }
    notes.push(`Away: ${res.note}`)
  }

  // One internal + one external = valid non-league game, Medium confidence
  const homeResolved = !!home_team_id
  const awayResolved = !!away_team_id
  if (!home_team_name || !away_team_name) {
    confidence = 'Low'
  } else if (homeResolved !== awayResolved) {
    // One Section X team + one external = valid non-league, bump to Medium
    confidence = 'Medium'
    notes.push('Non-league game vs external opponent')
  } else if (!homeResolved && !awayResolved) {
    confidence = 'Low'
  }

  return {
    id,
    raw: line,
    game_date,
    home_team_name,
    away_team_name,
    home_score,
    away_score,
    status,
    game_time,
    rescheduled_date,
    game_number,
    neutral_site,
    event_name,
    confidence,
    confidence_notes: notes,
    home_team_id,
    away_team_id,
    home_team_match: home_team_match || (external_home_name ? '[EXT] ' + external_home_name : null),
    away_team_match: away_team_match || (external_away_name ? '[EXT] ' + external_away_name : null),
    external_home_name,
    external_away_name,
    duplicate_warning: false,
    approved: confidence !== 'Low',
    error: null,
  }
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] || '' })
    return row
  })
}
export function parsePastedGames(...)
interface ArbiterParseOptions extends ParseOptions {
  sourceTeamId: string
  year: number
}

const ARBITER_DAY =
  '(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)'

const ARBITER_MONTH =
  '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'

function arbiterMonthNumber(month: string): string {
  const months: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  }

  return months[month.toLowerCase()] || '01'
}

function cleanArbiterText(text: string): string {
  let cleaned = text
    .replace(/\u00a0/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Remove Arbiter column header if it came along with the copy/paste
  cleaned = cleaned.replace(
    /^.*?Date\/Time\s+Home or Away\s+Opponent\s+Location\s+Results\s+Type\s+Links\s*/i,
    ''
  )

  // If anything still exists before the first actual game, remove it
  const firstGame = cleaned.search(
    new RegExp(`\\b${ARBITER_DAY}\\s+${ARBITER_MONTH}\\s+\\d{1,2}\\s+\\d{1,2}:\\d{2}\\s+(?:AM|PM)\\b`, 'i')
  )

  if (firstGame > 0) {
    cleaned = cleaned.slice(firstGame)
  }

  return cleaned.trim()
}

function findKnownOpponentPrefix(
  text: string,
  teams: TeamRecord[],
  sourceTeamId: string
): {
  opponent: string
  location: string | null
  resolution: ReturnType<typeof resolveTeamName>
} | null {
  const words = text.split(/\s+/).filter(Boolean)

  let best:
    | {
        opponent: string
        location: string | null
        resolution: ReturnType<typeof resolveTeamName>
        wordCount: number
      }
    | null = null

  const maxWords = Math.min(words.length, 12)

  for (let i = 1; i <= maxWords; i++) {
    const candidate = words.slice(0, i).join(' ')
    const resolution = resolveTeamName(candidate, teams)

    if (!resolution.id || resolution.id === sourceTeamId) continue

    if (resolution.confidence === 'High') {
      best = {
        opponent: candidate,
        location: words.slice(i).join(' ').trim() || null,
        resolution,
        wordCount: i,
      }
    } else if (resolution.confidence === 'Medium' && !best) {
      best = {
        opponent: candidate,
        location: words.slice(i).join(' ').trim() || null,
        resolution,
        wordCount: i,
      }
    }
  }

  if (!best) return null

  return {
    opponent: best.opponent,
    location: best.location,
    resolution: best.resolution,
  }
}

function splitExternalOpponentAndLocation(
  text: string,
  sourceTeam: TeamRecord,
  homeOrAway: '@' | 'vs'
): {
  opponent: string
  location: string | null
} {
  let working = text.trim()

  // Arbiter occasionally adds things like "with 1 others"
  working = working.replace(/\s+with\s+\d+\s+others?\b/i, '')

  // HOME GAME:
  // Arbiter location often begins with the source school's name.
  // Example:
  // "Beekmantown Central High School Ogdensburg Free Academy Turf Field"
  if (homeOrAway === 'vs') {
    const possibleLocationStarts = [
      sourceTeam.school_name,
      sourceTeam.team_name,
      ...sourceTeam.aliases,
    ]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)

    for (const name of possibleLocationStarts) {
      const index = working.toLowerCase().indexOf(name.toLowerCase())

      if (index > 0) {
        return {
          opponent: working.slice(0, index).trim(),
          location: working.slice(index).trim(),
        }
      }
    }
  }

  // External schools usually have a recognizable school suffix.
  // This allows:
  // "Carthage Central High School Lowville Main Turf"
  // to become opponent + location.
  const schoolSuffixMatch = working.match(
    /^(.+?(?:Central High School|Central School|High School|Junior Senior High School|Jr\.?\s*\/?\s*Sr\.?\s*High School|Academy|School District|CSD))\b\s*(.*)$/i
  )

  if (schoolSuffixMatch) {
    return {
      opponent: schoolSuffixMatch[1].trim(),
      location: schoolSuffixMatch[2].trim() || null,
    }
  }

  // Last-resort fallback:
  // keep the whole value as the opponent instead of inventing a split.
  return {
    opponent: working,
    location: null,
  }
}

export function parseArbiterSchedule(
  text: string,
  options: ArbiterParseOptions
): ParsedGameRow[] {
  fuseInstance = null

  const sourceTeam = options.teams.find(t => t.id === options.sourceTeamId)

  if (!sourceTeam) {
    return [
      {
        id: Math.random().toString(36).slice(2),
        raw: text,
        game_date: null,
        home_team_name: null,
        away_team_name: null,
        home_score: null,
        away_score: null,
        status: 'Scheduled',
        game_time: null,
        location: null,
        notes: null,
        rescheduled_date: null,
        game_number: null,
        neutral_site: false,
        event_name: null,
        confidence: 'Low',
        confidence_notes: ['Could not find the selected schedule team'],
        home_team_id: null,
        away_team_id: null,
        home_team_match: null,
        away_team_match: null,
        external_home_name: null,
        external_away_name: null,
        duplicate_warning: false,
        approved: false,
        error: 'Selected Arbiter schedule team was not found',
        sport_id: options.defaultSportId || null,
      },
    ]
  }

  const cleaned = cleanArbiterText(text)

  // Arbiter copy/paste often becomes one huge line.
  // Split it whenever another game date begins.
  const chunks = cleaned
    .split(
      new RegExp(
        `(?=\\b${ARBITER_DAY}\\s+${ARBITER_MONTH}\\s+\\d{1,2}\\s+\\d{1,2}:\\d{2}\\s+(?:AM|PM)\\b)`,
        'i'
      )
    )
    .map(s => s.trim())
    .filter(Boolean)

  const results: ParsedGameRow[] = []

  for (const chunk of chunks) {
    const header = chunk.match(
      new RegExp(
        `^${ARBITER_DAY}\\s+(${ARBITER_MONTH.replace('(?:', '').replace(')', '')})\\s+(\\d{1,2})\\s+(\\d{1,2}:\\d{2}\\s+(?:AM|PM))\\s+(@|vs)\\s+(.+)$`,
        'i'
      )
    )

    // Safer explicit fallback regex in case the generated month group is unhappy
    const match =
      header ||
      chunk.match(
        /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{1,2}:\d{2}\s+(?:AM|PM))\s+(@|vs)\s+(.+)$/i
      )

    if (!match) {
      results.push({
        id: Math.random().toString(36).slice(2),
        raw: chunk,
        game_date: null,
        home_team_name: null,
        away_team_name: null,
        home_score: null,
        away_score: null,
        status: 'Scheduled',
        game_time: null,
        location: null,
        notes: null,
        rescheduled_date: null,
        game_number: null,
        neutral_site: false,
        event_name: null,
        confidence: 'Low',
        confidence_notes: ['Could not parse Arbiter date/time/home-away format'],
        home_team_id: null,
        away_team_id: null,
        home_team_match: null,
        away_team_match: null,
        external_home_name: null,
        external_away_name: null,
        duplicate_warning: false,
        approved: false,
        error: 'Could not parse Arbiter row',
        sport_id: options.defaultSportId || null,
      })

      continue
    }

    const month = arbiterMonthNumber(match[1])
    const day = match[2].padStart(2, '0')
    const gameDate = `${options.year}-${month}-${day}`
    const gameTime = match[3]
    const homeOrAway = match[4].toLowerCase() as '@' | 'vs'

    let tail = match[5]
      .replace(/^Opponent\s+logo\s+/i, '')
      .trim()

    // Last Arbiter column is the game type:
    // L = League
    // N = Non-League
    // S = Scrimmage
    let arbiterType: string | null = null

    const typeMatch = tail.match(/\s+([LNS])\s*$/i)

    if (typeMatch) {
      const code = typeMatch[1].toUpperCase()

      arbiterType =
        code === 'L'
          ? 'League'
          : code === 'N'
            ? 'Non-League'
            : 'Scrimmage'

      tail = tail.slice(0, typeMatch.index).trim()
    }

    let opponentName = ''
    let location: string | null = null
    let opponentResolution:
      | ReturnType<typeof resolveTeamName>
      | null = null

    const known = findKnownOpponentPrefix(
      tail,
      options.teams,
      options.sourceTeamId
    )

    if (known) {
      opponentName = known.opponent
      location = known.location
      opponentResolution = known.resolution
    } else {
      const split = splitExternalOpponentAndLocation(
        tail,
        sourceTeam,
        homeOrAway
      )

      opponentName = split.opponent
      location = split.location
      opponentResolution = resolveTeamName(opponentName, options.teams)
    }

    const opponentIsInternal =
      !!opponentResolution?.id &&
      opponentResolution.id !== options.sourceTeamId

    const opponentTeamId = opponentIsInternal
      ? opponentResolution!.id
      : null

    const opponentDisplay =
      opponentIsInternal
        ? opponentResolution!.matched
        : opponentName

    let homeTeamName: string
    let awayTeamName: string
    let homeTeamId: string | null
    let awayTeamId: string | null
    let homeTeamMatch: string | null
    let awayTeamMatch: string | null
    let externalHomeName: string | null = null
    let externalAwayName: string | null = null

    if (homeOrAway === 'vs') {
      homeTeamName = sourceTeam.school_name
      awayTeamName = opponentName

      homeTeamId = sourceTeam.id
      awayTeamId = opponentTeamId

      homeTeamMatch = sourceTeam.school_name
      awayTeamMatch = opponentIsInternal
        ? opponentDisplay
        : `[EXT] ${opponentName}`

      if (!opponentIsInternal) {
        externalAwayName = opponentName
      }
    } else {
      homeTeamName = opponentName
      awayTeamName = sourceTeam.school_name

      homeTeamId = opponentTeamId
      awayTeamId = sourceTeam.id

      homeTeamMatch = opponentIsInternal
        ? opponentDisplay
        : `[EXT] ${opponentName}`

      awayTeamMatch = sourceTeam.school_name

      if (!opponentIsInternal) {
        externalHomeName = opponentName
      }
    }

    const confidence: ImportConfidence =
      opponentIsInternal ? 'High' : 'Medium'

    const confidenceNotes = [
      `Arbiter ${homeOrAway === 'vs' ? 'home' : 'away'} game`,
      opponentIsInternal
        ? `Opponent matched: ${opponentDisplay}`
        : `External opponent: ${opponentName}`,
    ]

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

      home_team_name: homeTeamName,
      away_team_name: awayTeamName,

      home_score: null,
      away_score: null,

      status: 'Scheduled',
      game_time: gameTime,

      location,
      notes: arbiterType ? `Arbiter type: ${arbiterType}` : null,

      rescheduled_date: null,
      game_number: null,

      neutral_site: false,
      event_name: null,

      confidence,
      confidence_notes: confidenceNotes,

      home_team_id: homeTeamId,
      away_team_id: awayTeamId,

      home_team_match: homeTeamMatch,
      away_team_match: awayTeamMatch,

      external_home_name: externalHomeName,
      external_away_name: externalAwayName,

      duplicate_warning: false,

      approved: confidence !== 'Low',

      error: null,

      sport_id: options.defaultSportId || null,
    })
  }

  return results
}
