// src/app/api/admin/arbiter-rosters/route.ts

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const PERSON_CONCURRENCY = 8

type D1Like = any

interface RosterRow {
  jerseyNumber?: string
  rawName?: string
  displayName: string
  firstName?: string
  lastName?: string
  classYear?: string
  position?: string
  height?: string
}

interface CoachRow {
  rawName?: string
  displayName: string
  firstName?: string
  lastName?: string
  title?: string
}

interface TeamRosterPayload {
  team_id: string
  season_id: string
  source_url?: string | null
  roster_found?: boolean
  coaches_found?: boolean
  roster?: RosterRow[]
  coaches?: CoachRow[]
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function normalizePersonKey(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function dedupePeople<T extends { displayName: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const row of rows) {
    const key = normalizePersonKey(row.displayName)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

async function mapBounded<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    output.push(...await Promise.all(batch.map(fn)))
  }
  return output
}

async function uniqueSlug(db: D1Like, table: 'athletes' | 'coaches', base: string): Promise<string> {
  const cleanBase = slugify(base) || 'person'
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? cleanBase : `${cleanBase}-${i + 1}`
    const row = await db.prepare(`SELECT id FROM ${table} WHERE slug=? LIMIT 1`).bind(candidate).first()
    if (!row) return candidate
  }
  return `${cleanBase}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

async function findOrCreateAthlete(db: D1Like, params: {
  schoolId: string
  schoolSlug: string
  displayName: string
  firstName: string
  lastName: string
  sourceUrl: string | null
}) {
  const sourceKey = normalizePersonKey(params.displayName)
  if (!sourceKey) throw new Error('Roster row is missing a usable athlete name.')

  const existing: any = await db.prepare(`SELECT id,slug FROM athletes WHERE school_id=? AND source='arbiter' AND source_key=? LIMIT 1`)
    .bind(params.schoolId, sourceKey).first()

  if (existing?.id) {
    await db.prepare(`UPDATE athletes SET first_name=?,last_name=?,display_name=?,source_url=?,active=1,updated_at=? WHERE id=?`)
      .bind(params.firstName || null, params.lastName || null, params.displayName, params.sourceUrl, new Date().toISOString(), existing.id).run()
    return existing.id as string
  }

  const id = crypto.randomUUID()
  const slug = await uniqueSlug(db, 'athletes', `${params.schoolSlug}-${params.displayName}`)
  const now = new Date().toISOString()
  await db.prepare(`INSERT INTO athletes (id,school_id,first_name,last_name,display_name,slug,source,source_key,source_url,active,created_at,updated_at)
    VALUES (?,?,?,?,?,?, 'arbiter',?,?,1,?,?)`)
    .bind(id, params.schoolId, params.firstName || null, params.lastName || null, params.displayName, slug, sourceKey, params.sourceUrl, now, now).run()
  return id
}

async function findOrCreateCoach(db: D1Like, params: {
  schoolId: string
  schoolSlug: string
  displayName: string
  firstName: string
  lastName: string
  sourceUrl: string | null
}) {
  const sourceKey = normalizePersonKey(params.displayName)
  if (!sourceKey) throw new Error('Coach row is missing a usable name.')

  const existing: any = await db.prepare(`SELECT id,slug FROM coaches WHERE school_id=? AND source='arbiter' AND source_key=? LIMIT 1`)
    .bind(params.schoolId, sourceKey).first()

  if (existing?.id) {
    await db.prepare(`UPDATE coaches SET first_name=?,last_name=?,display_name=?,source_url=?,active=1,updated_at=? WHERE id=?`)
      .bind(params.firstName || null, params.lastName || null, params.displayName, params.sourceUrl, new Date().toISOString(), existing.id).run()
    return existing.id as string
  }

  const id = crypto.randomUUID()
  const slug = await uniqueSlug(db, 'coaches', `${params.schoolSlug}-${params.displayName}`)
  const now = new Date().toISOString()
  await db.prepare(`INSERT INTO coaches (id,school_id,first_name,last_name,display_name,slug,source,source_key,source_url,active,created_at,updated_at)
    VALUES (?,?,?,?,?,?, 'arbiter',?,?,1,?,?)`)
    .bind(id, params.schoolId, params.firstName || null, params.lastName || null, params.displayName, slug, sourceKey, params.sourceUrl, now, now).run()
  return id
}

async function upsertRosterEntry(db: D1Like, args: {
  athleteId: string; teamId: string; seasonId: string; jersey: string | null; classYear: string | null;
  position: string | null; height: string | null; sourceUrl: string | null; now: string
}) {
  const existing: any = await db.prepare(`SELECT id FROM roster_entries WHERE team_id=? AND season_id=? AND athlete_id=? LIMIT 1`)
    .bind(args.teamId, args.seasonId, args.athleteId).first()
  if (existing?.id) {
    await db.prepare(`UPDATE roster_entries SET jersey_number=?,class_year=?,position=?,height=?,source='arbiter',source_url=?,active=1,imported_at=?,updated_at=? WHERE id=?`)
      .bind(args.jersey, args.classYear, args.position, args.height, args.sourceUrl, args.now, args.now, existing.id).run()
  } else {
    await db.prepare(`INSERT INTO roster_entries (id,athlete_id,team_id,season_id,jersey_number,class_year,position,height,source,source_url,active,imported_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,'arbiter',?,1,?,?,?)`)
      .bind(crypto.randomUUID(), args.athleteId, args.teamId, args.seasonId, args.jersey, args.classYear, args.position, args.height, args.sourceUrl, args.now, args.now, args.now).run()
  }
}

async function upsertTeamCoach(db: D1Like, args: {
  coachId: string; teamId: string; seasonId: string; title: string | null; sourceUrl: string | null; now: string
}) {
  const existing: any = await db.prepare(`SELECT id FROM team_coaches WHERE team_id=? AND season_id=? AND coach_id=? LIMIT 1`)
    .bind(args.teamId, args.seasonId, args.coachId).first()
  if (existing?.id) {
    await db.prepare(`UPDATE team_coaches SET title=?,source='arbiter',source_url=?,active=1,imported_at=?,updated_at=? WHERE id=?`)
      .bind(args.title, args.sourceUrl, args.now, args.now, existing.id).run()
  } else {
    await db.prepare(`INSERT INTO team_coaches (id,coach_id,team_id,season_id,title,source,source_url,active,imported_at,created_at,updated_at)
      VALUES (?,?,?,?,?,'arbiter',?,1,?,?,?)`)
      .bind(crypto.randomUUID(), args.coachId, args.teamId, args.seasonId, args.title, args.sourceUrl, args.now, args.now, args.now).run()
  }
}

async function deactivateMissing(db: D1Like, table: 'roster_entries' | 'team_coaches', idColumn: 'athlete_id' | 'coach_id', teamId: string, seasonId: string, keepIds: string[], now: string) {
  const rows = await db.prepare(`SELECT id,${idColumn} AS person_id FROM ${table} WHERE team_id=? AND season_id=? AND source='arbiter' AND active=1`)
    .bind(teamId, seasonId).all()
  const stale = (rows.results || []).filter((row: any) => !keepIds.includes(String(row.person_id)))
  if (!stale.length) return 0
  for (const row of stale) {
    await db.prepare(`UPDATE ${table} SET active=0,updated_at=? WHERE id=?`).bind(now, row.id).run()
  }
  return stale.length
}

async function syncOneTeam(db: D1Like, payload: TeamRosterPayload) {
  if (!payload.team_id || !payload.season_id) throw new Error('team_id and season_id are required.')

  const team: any = await db.prepare(`SELECT t.id,t.team_name,t.school_id,s.id AS school_id_join,s.school_name,s.slug AS school_slug
      FROM teams t LEFT JOIN schools s ON s.id=t.school_id WHERE t.id=? LIMIT 1`).bind(payload.team_id).first()
  if (!team) throw new Error('Could not load internal team: Not found')
  if (!team.school_id_join) throw new Error(`Team ${team.team_name} has no school mapping.`)

  const school = { id: team.school_id_join, school_name: team.school_name, slug: team.school_slug }
  const sourceUrl = cleanText(payload.source_url) || null
  const now = new Date().toISOString()
  let rosterImported = 0
  let rosterDeactivated = 0
  let coachesImported = 0
  let coachesDeactivated = 0
  const errors: string[] = []

  if (payload.roster_found === true) {
    const rosterRows = dedupePeople(payload.roster || [])
    const rosterResults = await mapBounded(rosterRows, PERSON_CONCURRENCY, async raw => {
      try {
        const displayName = cleanText(raw.displayName)
        if (!displayName) return null
        const athleteId = await findOrCreateAthlete(db, {
          schoolId: school.id,
          schoolSlug: school.slug || slugify(school.school_name),
          displayName,
          firstName: cleanText(raw.firstName),
          lastName: cleanText(raw.lastName),
          sourceUrl,
        })
        await upsertRosterEntry(db, {
          athleteId,
          teamId: payload.team_id,
          seasonId: payload.season_id,
          jersey: cleanText(raw.jerseyNumber) || null,
          classYear: cleanText(raw.classYear) || null,
          position: cleanText(raw.position) || null,
          height: cleanText(raw.height) || null,
          sourceUrl,
          now,
        })
        return athleteId
      } catch (error: any) {
        errors.push(`${team.team_name} roster: ${error?.message || 'Unknown error'}`)
        return null
      }
    })

    const currentAthleteIds = rosterResults.filter(Boolean) as string[]
    rosterImported = currentAthleteIds.length
    if (!errors.some(error => error.startsWith(`${team.team_name} roster:`))) {
      try {
        rosterDeactivated = await deactivateMissing(db, 'roster_entries', 'athlete_id', payload.team_id, payload.season_id, currentAthleteIds, now)
      } catch (error: any) {
        errors.push(`${team.team_name} roster cleanup: ${error?.message || 'Unknown error'}`)
      }
    }
  }

  if (payload.coaches_found === true) {
    const coachRows = dedupePeople(payload.coaches || [])
    const coachResults = await mapBounded(coachRows, PERSON_CONCURRENCY, async raw => {
      try {
        const displayName = cleanText(raw.displayName)
        if (!displayName) return null
        const coachId = await findOrCreateCoach(db, {
          schoolId: school.id,
          schoolSlug: school.slug || slugify(school.school_name),
          displayName,
          firstName: cleanText(raw.firstName),
          lastName: cleanText(raw.lastName),
          sourceUrl,
        })
        await upsertTeamCoach(db, {
          coachId,
          teamId: payload.team_id,
          seasonId: payload.season_id,
          title: cleanText(raw.title) || null,
          sourceUrl,
          now,
        })
        return coachId
      } catch (error: any) {
        errors.push(`${team.team_name} coach: ${error?.message || 'Unknown error'}`)
        return null
      }
    })

    const currentCoachIds = coachResults.filter(Boolean) as string[]
    coachesImported = currentCoachIds.length
    if (!errors.some(error => error.startsWith(`${team.team_name} coach:`))) {
      try {
        coachesDeactivated = await deactivateMissing(db, 'team_coaches', 'coach_id', payload.team_id, payload.season_id, currentCoachIds, now)
      } catch (error: any) {
        errors.push(`${team.team_name} coach cleanup: ${error?.message || 'Unknown error'}`)
      }
    }
  }

  return {
    team_id: payload.team_id,
    team_name: team.team_name,
    rosterImported,
    rosterDeactivated,
    coachesImported,
    coachesDeactivated,
    errors,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const teams: TeamRosterPayload[] = Array.isArray(body?.teams) ? body.teams : body?.team_id ? [body] : []
    if (!teams.length) return NextResponse.json({ error: 'At least one team roster payload is required.' }, { status: 400 })

    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

    const results = []
    const errors: string[] = []
    let rosterImported = 0
    let coachesImported = 0

    for (const team of teams) {
      try {
        const result = await syncOneTeam(db, team)
        results.push(result)
        rosterImported += result.rosterImported
        coachesImported += result.coachesImported
        errors.push(...result.errors)
      } catch (error: any) {
        errors.push(error?.message || 'Team roster sync failed.')
      }
    }

    return NextResponse.json({ success: errors.length === 0, teamsProcessed: results.length, rosterImported, coachesImported, results, errors })
  } catch (error: any) {
    console.error('Arbiter roster publish error:', error)
    return NextResponse.json({ error: error?.message || 'Could not publish Arbiter roster data.' }, { status: 500 })
  }
}
