import { getCloudflareContext } from '@opennextjs/cloudflare'

export type ScoreSource = 'manual-batch' | 'highschoolsportstats' | 'northcountrysports' | 'other'

export type ScoreRecord = {
  date: string
  sport?: string | null
  away: string
  awayScore: number
  home: string
  homeScore: number
  status?: string | null
  sourceKey?: string | null
  sourceUrl?: string | null
}

type ParseDefaults = { defaultDate?: string | null; defaultSport?: string | null }

const clean = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const scoreNum = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null)
const dateOnly = (v: unknown) => {
  const s = String(v ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

const suffixes = [
  'central school district', 'central high school', 'central school', 'high school',
  'junior senior high school', 'jr sr high school', 'academy',
]

function schoolKey(v: unknown) {
  let c = clean(v)
    .replace(/\bogdensburg free academy\b/g, 'ogdensburg')
    .replace(/\bofa\b/g, 'ogdensburg')
    .replace(/\bst[ .]?lawrence\b/g, 'st lawrence')
  for (const s of suffixes) c = c.replace(new RegExp(`\\b${s.replace(/ /g, '\\s+')}\\b`, 'g'), ' ')
  return c
    .replace(/\b(boys|girls|varsity|soccer|football|volleyball|basketball|hockey|softball|baseball|lacrosse|swimming|cross country)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sportIdentity(name: unknown, gender?: unknown) {
  const raw = clean(name), g = clean(gender)
  const inferred = raw.includes('girls') || raw.includes('womens')
    ? 'girls'
    : raw.includes('boys') || raw.includes('mens')
      ? 'boys'
      : g.includes('girl') || g.includes('women')
        ? 'girls'
        : g.includes('boy') || g.includes('men') ? 'boys' : ''
  const base = raw.replace(/\b(boys|girls|mens|womens|varsity)\b/g, '').replace(/\s+/g, ' ').trim()
  return `${inferred}:${base}`
}

function splitDelimited(line: string) {
  const delimiter = line.includes('\t') ? '\t' : line.includes('|') ? '|' : ','
  return line.split(delimiter).map(x => x.trim())
}

function parseCompactScoreLine(line: string, defaults: ParseDefaults): ScoreRecord | null {
  const match = line.replace(/\bfinal\b/gi, '').trim().match(/^(.+?)\s+(\d+)[,\s]+(.+?)\s+(\d+)\s*$/)
  if (!match) return null
  const date = dateOnly(defaults.defaultDate)
  const sport = String(defaults.defaultSport || '').trim()
  if (!date || !sport) return null
  return { date, sport, away: match[1].trim(), awayScore: Number(match[2]), home: match[3].trim(), homeScore: Number(match[4]), status: 'Final' }
}

export function parseScoreText(text: string, defaults: ParseDefaults = {}): { records: ScoreRecord[]; errors: string[] } {
  const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  const records: ScoreRecord[] = [], errors: string[] = []
  if (!lines.length) return { records, errors: ['No score rows were provided.'] }

  const firstParts = splitDelimited(lines[0]).map(x => clean(x))
  const hasHeader = firstParts.some(x => ['date', 'sport', 'away', 'away team', 'away score', 'home', 'home team', 'home score'].includes(x))
  const header: Record<string, number> = {}
  let start = 0
  if (hasHeader) { firstParts.forEach((x, i) => { header[x] = i }); start = 1 }
  const pick = (parts: string[], names: string[], fallback: number) => {
    for (const n of names) if (header[n] != null) return parts[header[n]] ?? ''
    return parts[fallback] ?? ''
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i], parts = splitDelimited(line)
    let date = '', sport = '', away = '', home = '', awayRaw = '', homeRaw = ''
    if (hasHeader) {
      date = pick(parts, ['date'], -1) || String(defaults.defaultDate || '')
      sport = pick(parts, ['sport'], -1) || String(defaults.defaultSport || '')
      away = pick(parts, ['away', 'away team'], 0); awayRaw = pick(parts, ['away score'], 1)
      home = pick(parts, ['home', 'home team'], 2); homeRaw = pick(parts, ['home score'], 3)
    } else if (parts.length >= 6) {
      ;[date, sport, away, awayRaw, home, homeRaw] = parts
    } else if (parts.length === 4) {
      date = String(defaults.defaultDate || ''); sport = String(defaults.defaultSport || '')
      ;[away, awayRaw, home, homeRaw] = parts
    } else {
      const compact = parseCompactScoreLine(line, defaults)
      if (compact) { records.push(compact); continue }
      errors.push(`Line ${i + 1}: use Away, Away Score, Home, Home Score after choosing a date and sport, or include all six columns.`)
      continue
    }
    const normalizedDate = dateOnly(date || defaults.defaultDate)
    const normalizedSport = String(sport || defaults.defaultSport || '').trim()
    const as = scoreNum(awayRaw), hs = scoreNum(homeRaw)
    if (!normalizedDate || !normalizedSport || !away || !home || as === null || hs === null) {
      errors.push(`Line ${i + 1}: could not parse a complete final score.`); continue
    }
    records.push({ date: normalizedDate, sport: normalizedSport, away, awayScore: as, home, homeScore: hs, status: 'Final' })
  }
  return { records, errors }
}

function getDb() {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

export async function previewScores(records: ScoreRecord[], source: ScoreSource) {
  const db = getDb()
  const dates = records.map(r => r.date).filter(Boolean).sort()
  if (!dates.length) return { source, summary: { received: 0, matched: 0, safe: 0, verified: 0, conflicts: 0, protected: 0, ambiguous: 0, unmatched: 0, gamesCreated: 0 }, rows: [] }

  const [gameQ, teamQ, schoolQ, sportQ, extQ] = await Promise.all([
    db.prepare(`SELECT id,game_date,game_time,sport_id,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id,home_score,away_score,status,source,verification_status,contest_type,result_exempt FROM games WHERE game_date>=? AND game_date<=?`).bind(dates[0], dates[dates.length - 1]).all(),
    db.prepare(`SELECT id,team_name,school_id,sport_id FROM teams`).all(),
    db.prepare(`SELECT id,school_name,alias,slug FROM schools`).all(),
    db.prepare(`SELECT id,sport_name,gender,slug FROM sports`).all(),
    db.prepare(`SELECT id,name,slug FROM external_opponents`).all(),
  ])
  const games = gameQ.results || [], teams = teamQ.results || [], schools = schoolQ.results || [], sports = sportQ.results || [], ext = extQ.results || []
  const schoolById = new Map(schools.map((x: any) => [x.id, x]))
  const teamById = new Map(teams.map((x: any) => [x.id, x]))
  const sportById = new Map(sports.map((x: any) => [x.id, x]))
  const extById = new Map(ext.map((x: any) => [x.id, x]))

  const sideName = (g: any, home: boolean) => {
    const tid = home ? g.home_team_id : g.away_team_id, eid = home ? g.external_home_opponent_id : g.external_away_opponent_id
    if (tid) { const t = teamById.get(tid) as any; const s = schoolById.get(t?.school_id) as any; return s?.school_name || t?.team_name || '' }
    if (eid) return (extById.get(eid) as any)?.name || ''
    return ''
  }

  const rows = records.map((r, index) => {
    const aKey = schoolKey(r.away), hKey = schoolKey(r.home), srcSport = r.sport ? sportIdentity(r.sport) : ''
    const candidates = games.filter((g: any) => g.game_date === r.date).filter((g: any) => {
      if (srcSport) { const s = sportById.get(g.sport_id) as any; if (s && sportIdentity(s.sport_name, s.gender) !== srcSport) return false }
      const dbH = schoolKey(sideName(g, true)), dbA = schoolKey(sideName(g, false))
      return (dbH === hKey && dbA === aKey) || (dbH === aKey && dbA === hKey)
    })
    if (candidates.length !== 1) return { index, ...r, bucket: candidates.length ? 'ambiguous' : 'unmatched', safeToApply: false, candidateGameIds: candidates.map((g: any) => g.id) }

    const g: any = candidates[0]
    const dbHomeName = sideName(g, true), dbAwayName = sideName(g, false)
    const sameOrientation = schoolKey(dbHomeName) === hKey && schoolKey(dbAwayName) === aKey
    const desiredHome = sameOrientation ? r.homeScore : r.awayScore, desiredAway = sameOrientation ? r.awayScore : r.homeScore
    const dbHome = g.home_score == null ? null : Number(g.home_score), dbAway = g.away_score == null ? null : Number(g.away_score)
    const blank = dbHome === null && dbAway === null, same = dbHome === desiredHome && dbAway === desiredAway
    const protectedStatus = ['postponed', 'canceled', 'cancelled'].includes(clean(g.status)), scrimmage = clean(g.contest_type) === 'scrimmage', resultExempt = Boolean(g.result_exempt)
    let bucket = 'conflict', safeToApply = false
    if (same) bucket = 'verified'
    else if (scrimmage || protectedStatus || resultExempt) bucket = 'protected'
    else if (blank) { bucket = 'safe-fill'; safeToApply = true }
    const sport = sportById.get(g.sport_id) as any
    return {
      index, ...r, gameId: g.id, bucket, safeToApply,
      matched: { home: dbHomeName, away: dbAwayName, sport: sport?.sport_name || null, gender: sport?.gender || null, currentHome: dbHome, currentAway: dbAway, currentStatus: g.status, currentSource: g.source, contestType: g.contest_type },
      desired: { home: desiredHome, away: desiredAway, status: 'Final' },
    }
  })
  const count = (b: string) => rows.filter((r: any) => r.bucket === b).length
  return { source, summary: { received: rows.length, matched: rows.filter((r: any) => r.gameId).length, safe: count('safe-fill'), verified: count('verified'), conflicts: count('conflict'), protected: count('protected'), ambiguous: count('ambiguous'), unmatched: count('unmatched'), gamesCreated: 0 }, rows }
}

export async function applyPreviewRows(rows: any[], source: ScoreSource) {
  const db = getDb()
  let updated = 0, skipped = 0, failed = 0
  const actions: any[] = []
  for (const row of rows) {
    if (!row?.gameId || !row?.safeToApply || row.bucket !== 'safe-fill') { skipped++; continue }
    try {
      const game: any = await db.prepare(`SELECT id,home_score,away_score,status,contest_type,source,result_exempt FROM games WHERE id=? LIMIT 1`).bind(row.gameId).first()
      if (!game) throw new Error('Game not found')
      const currentBlank = game.home_score == null && game.away_score == null
      const statusProtected = ['postponed', 'canceled', 'cancelled'].includes(clean(game.status))
      const scrimmage = clean(game.contest_type) === 'scrimmage', resultExempt = Boolean(game.result_exempt)
      if (!currentBlank || statusProtected || scrimmage || resultExempt) {
        skipped++; actions.push({ gameId: row.gameId, outcome: 'score-protected' }); continue
      }

      const now = new Date().toISOString()
      const result = await db.prepare(`UPDATE games SET home_score=?,away_score=?,status='Final',verification_status='Reported',updated_at=? WHERE id=? AND home_score IS NULL AND away_score IS NULL AND lower(COALESCE(status,'')) NOT IN ('postponed','canceled','cancelled') AND lower(COALESCE(contest_type,''))<>'scrimmage' AND COALESCE(result_exempt,0)=0`)
        .bind(Number(row.desired.home), Number(row.desired.away), now, row.gameId).run()
      if (Number(result.meta?.changes || 0) !== 1) {
        skipped++; actions.push({ gameId: row.gameId, outcome: 'concurrent-score-protected' }); continue
      }
      const verified: any = await db.prepare(`SELECT home_score,away_score,status FROM games WHERE id=? LIMIT 1`).bind(row.gameId).first()
      if (!verified || Number(verified.home_score) !== Number(row.desired.home) || Number(verified.away_score) !== Number(row.desired.away) || clean(verified.status) !== 'final') {
        skipped++; actions.push({ gameId: row.gameId, outcome: 'concurrent-score-protected' }); continue
      }
      updated++; actions.push({ gameId: row.gameId, outcome: 'updated-existing-game', scoreSource: source })
    } catch (error) {
      failed++; actions.push({ gameId: row.gameId, outcome: 'failed', error: error instanceof Error ? error.message : String(error) })
    }
  }
  return { updated, skipped, failed, gamesCreated: 0, actions }
}
