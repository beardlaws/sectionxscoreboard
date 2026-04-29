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

  if (home_team_name && options.teams.length > 0) {
    const res = resolveTeamName(home_team_name, options.teams)
    home_team_id = res.id
    home_team_match = res.matched
    if (res.confidence === 'Low') confidence = 'Low'
    else if (res.confidence === 'Medium' && confidence === 'High') confidence = 'Medium'
    notes.push(`Home: ${res.note}`)
  }

  if (away_team_name && options.teams.length > 0) {
    const res = resolveTeamName(away_team_name, options.teams)
    away_team_id = res.id
    away_team_match = res.matched
    if (res.confidence === 'Low') confidence = 'Low'
    else if (res.confidence === 'Medium' && confidence === 'High') confidence = 'Medium'
    notes.push(`Away: ${res.note}`)
  }

  if (!home_team_name || !away_team_name) confidence = 'Low'

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
    home_team_match,
    away_team_match,
    duplicate_warning: false,
    approved: false,
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
