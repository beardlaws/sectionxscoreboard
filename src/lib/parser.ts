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
      threshold: 0.35,
      includeScore: true,
    })
  }
  return fuseInstance
}

export function resetFuse() {
  fuseInstance = null
}

function resolveTeamName(raw: string, teams: TeamRecord[]): {
  id: string | null
  matched: string | null
  confidence: ImportConfidence
  note: string
} {
  const trimmed = raw.trim()

  // Exact school alias match
  const aliasResolved = SCHOOL_ALIASES[trimmed]
  if (aliasResolved) {
    const found = teams.find(
      t => t.school_name.toLowerCase() === aliasResolved.toLowerCase()
    )
    if (found) {
      return { id: found.id, matched: found.school_name, confidence: 'High', note: `Alias: ${trimmed}` }
    }
  }

  // Exact team_name match
  const exact = teams.find(t =>
    t.team_name.toLowerCase() === trimmed.toLowerCase() ||
    t.school_name.toLowerCase() === trimmed.toLowerCase()
  )
  if (exact) {
    return { id: exact.id, matched: exact.school_name, confidence: 'High', note: 'Exact match' }
  }

  // Partial match
  const partial = teams.find(t =>
    t.school_name.toLowerCase().includes(trimmed.toLowerCase()) ||
    trimmed.toLowerCase().includes(t.school_name.toLowerCase().split(' ')[0])
  )
  if (partial) {
    return { id: partial.id, matched: partial.school_name, confidence: 'Medium', note: 'Partial match' }
  }

  // Fuzzy
  const fuse = getFuse(teams)
  const results = fuse.search(trimmed)
  if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.4) {
    return {
      id: results[0].item.id,
      matched: results[0].item.school_name,
      confidence: 'Medium',
      note: `Fuzzy match (score: ${results[0].score?.toFixed(2)})`
    }
  }

  return { id: null, matched: null, confidence: 'Low', note: `No match found for "${trimmed}"` }
}

function parseTime(str: string): string | null {
  const timeMatch = str.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i)
  if (timeMatch) {
    return timeMatch[0]
  }
  return null
}

function parseDate(str: string, defaultDate?: string): string | null {
  // Various date formats
  const formats = [
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{1,2}),? ?(\d{4})?\b/i,
  ]
  for (const fmt of formats) {
    const m = str.match(fmt)
    if (m) {
      // Return ISO string
      try {
        const d = new Date(m[0])
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0]
        }
      } catch {}
    }
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
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const results: ParsedGameRow[] = []

  for (const line of lines) {
    const row = parseSingleLine(line, options)
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

  // Event/tournament name in brackets
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

  // Doubleheader game number
  const dblMatch = working.match(/\((\d+)(?:st|nd|rd|th)?\s*game\)/i)
  if (dblMatch) {
    game_number = parseInt(dblMatch[1])
    working = working.replace(dblMatch[0], '').trim()
  }

  // Status keywords
  if (/\bfinal\b/i.test(working)) {
    status = 'Final'
    working = working.replace(/\bfinal\b/gi, '').trim()
  } else if (/\bppd\.\s*to\s*([\d/]+)/i.test(working)) {
    const rdMatch = working.match(/\bppd\.\s*to\s*([\d/]+)/i)
    if (rdMatch) {
      rescheduled_date = parseDate(rdMatch[1])
    }
    status = 'Postponed'
    working = working.replace(/\bppd\.[^\n]*/gi, '').trim()
  } else if (/\bppd\b|\bpostponed\b/i.test(working)) {
    status = 'Postponed'
    working = working.replace(/\b(ppd|postponed)\b/gi, '').trim()
  } else if (/\bcanceled\b|\bcancelled\b/i.test(working)) {
    status = 'Canceled'
    working = working.replace(/\b(canceled|cancelled)\b/gi, '').trim()
  }

  // Time
  game_time = parseTime(working)
  if (game_time) {
    working = working.replace(game_time, '').trim()
  }

  // Date
  const game_date = parseDate(working, options.defaultDate)
  if (game_date) {
    // Remove date from working string
    working = working.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, '').trim()
  }

  // Clean up punctuation artifacts
  working = working.replace(/,\s*$/, '').replace(/^\s*,/, '').trim()

  // Pattern: "Team A score, Team B score" or "Team A score Team B score"
  // or "Team A at Team B score" or "Team A score at Team B"
  let home_team_name: string | null = null
  let away_team_name: string | null = null

  // Try "Away at Home, score" or "Away at Home score"
  const atPattern = working.match(/^(.+?)\s+at\s+(.+?)(?:\s+(\d+)[-,\s]+(\d+))?$/i)
  if (atPattern) {
    away_team_name = atPattern[1].trim()
    home_team_name = atPattern[2].trim()
    if (atPattern[3] && atPattern[4]) {
      // away score at home — tricky; parse from context
      // "Canton at Massena 3-1" usually means home scored last or is listed second
      // Convention: listed "Away at Home, HomeScore-AwayScore" — but varies
      // Store as given
      home_score = parseInt(atPattern[4])
      away_score = parseInt(atPattern[3])
      if (status === 'Scheduled') status = 'Final'
    }
  } else {
    // Try "Team A N, Team B M" or "Team A N Team B M"
    const scorePattern = working.match(/^(.+?)\s+(\d+)[,\s]+(.+?)\s+(\d+)$/)
    if (scorePattern) {
      away_team_name = scorePattern[1].trim()
      away_score = parseInt(scorePattern[2])
      home_team_name = scorePattern[3].trim()
      home_score = parseInt(scorePattern[4])
      if (status === 'Scheduled') status = 'Final'
    } else {
      // Try just two team names
      const vsPattern = working.match(/^(.+?)\s+(?:vs\.?)\s+(.+)$/i)
      if (vsPattern) {
        away_team_name = vsPattern[1].trim()
        home_team_name = vsPattern[2].trim()
      } else {
        // Fallback: split by comma
        const parts = working.split(',').map(p => p.trim()).filter(Boolean)
        if (parts.length >= 2) {
          away_team_name = parts[0]
          home_team_name = parts[1]
        } else {
          notes.push(`Could not parse teams from: "${working}"`)
        }
      }
    }
  }

  // Clean team names (remove stray scores that got left in)
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

// CSV parser
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
