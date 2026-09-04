import { createAdminClient } from '@/lib/supabase/server'
import { applyPreviewRows, previewScores, ScoreRecord } from '@/lib/scores/intelligence'

const SOURCE_URL = 'https://www.northcountrysports.net/'

const SPORT_HEADINGS: Record<string, string> = {
  'BOYS FOOTBALL': 'Boys Football',
  'BOYS SOCCER': 'Boys Soccer',
  'GIRLS SOCCER': 'Girls Soccer',
  'GIRLS VOLLEYBALL': 'Girls Volleyball',
  'BOYS SWIMMING': 'Boys Swimming',
  'GIRLS SWIMMING': 'Girls Swimming',
  'BOYS BASKETBALL': 'Boys Basketball',
  'GIRLS BASKETBALL': 'Girls Basketball',
  'BOYS HOCKEY': 'Boys Hockey',
  'GIRLS HOCKEY': 'Girls Hockey',
  'BOYS BASEBALL': 'Boys Baseball',
  'GIRLS SOFTBALL': 'Girls Softball',
  'BOYS LACROSSE': 'Boys Lacrosse',
  'GIRLS LACROSSE': 'Girls Lacrosse',
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '–')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function htmlLines(html: string) {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|h1|h2|h3|h4|h5|h6|tr|td|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return decodeHtml(text)
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function longDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

function cleanTeam(value: string) {
  return value
    .replace(/^\s*\(#?\d+\)\s*/i, '')
    .replace(/^\s*#\d+\s*/i, '')
    .replace(/^\s*x-\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function resultRecord(line: string, date: string, sport: string): ScoreRecord | null {
  const match = line.match(/^(.+?)\s+(\d+)\s*[,\.]\s*(.+?)\s+(\d+)(?:\s+\([^)]*\))?\s*$/)
  if (!match) return null

  const away = cleanTeam(match[1])
  const home = cleanTeam(match[3])
  if (!away || !home) return null

  return {
    date,
    sport,
    away,
    awayScore: Number(match[2]),
    home,
    homeScore: Number(match[4]),
    status: 'Final',
    sourceKey: `${date}:${sport}:${away}:${home}`,
    sourceUrl: SOURCE_URL,
  }
}

export async function fetchNorthCountrySportsScores(date: string) {
  const response = await fetch(SOURCE_URL, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'SectionXScoreboard/1.0 (+https://sectionxscoreboard.com)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`North Country Sports returned HTTP ${response.status}`)
  }

  const html = await response.text()
  const lines = htmlLines(html)
  const marker = `${longDate(date)} SCORES`.toLowerCase()
  const start = lines.findIndex(line => line.toLowerCase() === marker)

  if (start < 0) {
    return {
      source: 'northcountrysports' as const,
      sourceUrl: SOURCE_URL,
      date,
      published: false,
      records: [] as ScoreRecord[],
      reason: `No published score block found for ${longDate(date)}.`,
    }
  }

  const records: ScoreRecord[] = []
  let sport = ''

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    const upper = line.toUpperCase()

    if (/^SCORES FOR\b/i.test(line) || /^[A-Z][A-Za-z]+ \d{1,2}, \d{4} SCORES$/i.test(line)) break

    if (SPORT_HEADINGS[upper]) {
      sport = SPORT_HEADINGS[upper]
      continue
    }

    if (/^COLLEGE\b/i.test(line)) {
      sport = ''
      continue
    }

    if (!sport) continue

    const record = resultRecord(line, date, sport)
    if (record) records.push(record)
  }

  return {
    source: 'northcountrysports' as const,
    sourceUrl: SOURCE_URL,
    date,
    published: true,
    records,
    reason: records.length ? null : 'Score block was published, but no supported game scores were parsed.',
  }
}

async function coverageForDate(date: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('games')
    .select('id,status,contest_type,home_score,away_score')
    .eq('game_date', date)

  if (error) throw new Error(`Could not calculate score coverage: ${error.message}`)

  const rows = data || []
  const official = rows.filter((g: any) => {
    const type = String(g.contest_type || '').toLowerCase()
    const status = String(g.status || '').toLowerCase()
    return type !== 'scrimmage' && !['canceled', 'cancelled', 'postponed'].includes(status)
  })
  const complete = official.filter((g: any) =>
    String(g.status || '').toLowerCase() === 'final' &&
    g.home_score != null &&
    g.away_score != null
  ).length

  return {
    officialGames: official.length,
    complete,
    missing: Math.max(official.length - complete, 0),
    percent: official.length ? Math.round((complete / official.length) * 100) : 100,
    scrimmages: rows.filter((g: any) => String(g.contest_type || '').toLowerCase() === 'scrimmage').length,
  }
}

export async function runNorthCountrySportsSweep(date: string, apply = true) {
  const db = createAdminClient()
  const source = await fetchNorthCountrySportsScores(date)
  const preview = await previewScores(source.records, 'northcountrysports')
  const safeRows = (preview.rows || []).filter((row: any) => row.safeToApply)
  const applied = apply
    ? await applyPreviewRows(safeRows, 'northcountrysports')
    : { updated: 0, skipped: 0, failed: 0, gamesCreated: 0, actions: [] }

  const coverage = await coverageForDate(date)
  const audit = {
    source: source.source,
    sourceUrl: source.sourceUrl,
    date,
    published: source.published,
    parsed: source.records.length,
    preview: preview.summary,
    applied,
    coverage,
  }

  await db.from('import_logs').insert({
    import_type: 'overnight-score-sweep',
    raw_input: JSON.stringify(audit),
    rows_parsed: source.records.length,
    rows_approved: applied.updated,
    rows_rejected: Math.max(source.records.length - applied.updated, 0),
    status: applied.failed ? 'partial' : source.published ? 'complete' : 'waiting-source',
    imported_by: 'automation:northcountrysports',
  })

  return {
    ok: applied.failed === 0,
    source: source.source,
    sourceUrl: source.sourceUrl,
    date,
    published: source.published,
    reason: source.reason,
    parsed: source.records.length,
    preview: preview.summary,
    applied,
    coverage,
  }
}
