// src/app/api/admin/arbiter-rosters/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const PERSON_CONCURRENCY = 8

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

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function cleanText(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim()
    : ''
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

async function uniqueSlug(
  supabase: any,
  table: 'athletes' | 'coaches',
  base: string
): Promise<string> {
  const cleanBase = slugify(base) || 'person'

  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? cleanBase : `${cleanBase}-${i + 1}`

    const { data } = await supabase
      .from(table)
      .select('id')
      .eq('slug', candidate)
      .limit(1)

    if (!data || data.length === 0) return candidate
  }

  return `${cleanBase}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

async function findOrCreateAthlete(
  supabase: any,
  params: {
    schoolId: string
    schoolSlug: string
    displayName: string
    firstName: string
    lastName: string
    sourceUrl: string | null
  }
) {
  const sourceKey = normalizePersonKey(params.displayName)
  if (!sourceKey) throw new Error('Roster row is missing a usable athlete name.')

  const { data: existing, error: findError } = await supabase
    .from('athletes')
    .select('id, slug')
    .eq('school_id', params.schoolId)
    .eq('source', 'arbiter')
    .eq('source_key', sourceKey)
    .limit(1)

  if (findError) throw new Error(`Athlete lookup failed: ${findError.message}`)

  if (existing && existing.length > 0) {
    const athlete = existing[0]
    const { error: updateError } = await supabase
      .from('athletes')
      .update({
        first_name: params.firstName || null,
        last_name: params.lastName || null,
        display_name: params.displayName,
        source_url: params.sourceUrl,
        active: true,
      })
      .eq('id', athlete.id)

    if (updateError) throw new Error(`Athlete update failed: ${updateError.message}`)
    return athlete.id as string
  }

  const slug = await uniqueSlug(supabase, 'athletes', `${params.schoolSlug}-${params.displayName}`)
  const { data: created, error: createError } = await supabase
    .from('athletes')
    .insert({
      school_id: params.schoolId,
      first_name: params.firstName || null,
      last_name: params.lastName || null,
      display_name: params.displayName,
      slug,
      source: 'arbiter',
      source_key: sourceKey,
      source_url: params.sourceUrl,
      active: true,
    })
    .select('id')
    .single()

  if (createError || !created?.id) {
    throw new Error(`Athlete insert failed: ${createError?.message || 'Unknown error'}`)
  }

  return created.id as string
}

async function findOrCreateCoach(
  supabase: any,
  params: {
    schoolId: string
    schoolSlug: string
    displayName: string
    firstName: string
    lastName: string
    sourceUrl: string | null
  }
) {
  const sourceKey = normalizePersonKey(params.displayName)
  if (!sourceKey) throw new Error('Coach row is missing a usable name.')

  const { data: existing, error: findError } = await supabase
    .from('coaches')
    .select('id, slug')
    .eq('school_id', params.schoolId)
    .eq('source', 'arbiter')
    .eq('source_key', sourceKey)
    .limit(1)

  if (findError) throw new Error(`Coach lookup failed: ${findError.message}`)

  if (existing && existing.length > 0) {
    const coach = existing[0]
    const { error: updateError } = await supabase
      .from('coaches')
      .update({
        first_name: params.firstName || null,
        last_name: params.lastName || null,
        display_name: params.displayName,
        source_url: params.sourceUrl,
        active: true,
      })
      .eq('id', coach.id)

    if (updateError) throw new Error(`Coach update failed: ${updateError.message}`)
    return coach.id as string
  }

  const slug = await uniqueSlug(supabase, 'coaches', `${params.schoolSlug}-${params.displayName}`)
  const { data: created, error: createError } = await supabase
    .from('coaches')
    .insert({
      school_id: params.schoolId,
      first_name: params.firstName || null,
      last_name: params.lastName || null,
      display_name: params.displayName,
      slug,
      source: 'arbiter',
      source_key: sourceKey,
      source_url: params.sourceUrl,
      active: true,
    })
    .select('id')
    .single()

  if (createError || !created?.id) {
    throw new Error(`Coach insert failed: ${createError?.message || 'Unknown error'}`)
  }

  return created.id as string
}

async function syncOneTeam(supabase: any, payload: TeamRosterPayload) {
  if (!payload.team_id || !payload.season_id) throw new Error('team_id and season_id are required.')

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select(`id,team_name,school_id,school:schools(id,school_name,slug)`)
    .eq('id', payload.team_id)
    .single()

  if (teamError || !team) {
    throw new Error(`Could not load internal team: ${teamError?.message || 'Not found'}`)
  }

  const school = Array.isArray((team as any).school) ? (team as any).school[0] : (team as any).school
  if (!school?.id) throw new Error(`Team ${team.team_name} has no school mapping.`)

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

        const athleteId = await findOrCreateAthlete(supabase, {
          schoolId: school.id,
          schoolSlug: school.slug || slugify(school.school_name),
          displayName,
          firstName: cleanText(raw.firstName),
          lastName: cleanText(raw.lastName),
          sourceUrl,
        })

        const { error: upsertError } = await supabase
          .from('roster_entries')
          .upsert({
            athlete_id: athleteId,
            team_id: payload.team_id,
            season_id: payload.season_id,
            jersey_number: cleanText(raw.jerseyNumber) || null,
            class_year: cleanText(raw.classYear) || null,
            position: cleanText(raw.position) || null,
            height: cleanText(raw.height) || null,
            source: 'arbiter',
            source_url: sourceUrl,
            active: true,
            imported_at: now,
            updated_at: now,
          }, { onConflict: 'team_id,season_id,athlete_id' })

        if (upsertError) throw new Error(upsertError.message)
        return athleteId
      } catch (error: any) {
        errors.push(`${team.team_name} roster: ${error?.message || 'Unknown error'}`)
        return null
      }
    })

    const currentAthleteIds = rosterResults.filter(Boolean) as string[]
    rosterImported = currentAthleteIds.length

    if (errors.filter(error => error.startsWith(`${team.team_name} roster:`)).length === 0) {
      let staleQuery = supabase
        .from('roster_entries')
        .select('id')
        .eq('team_id', payload.team_id)
        .eq('season_id', payload.season_id)
        .eq('source', 'arbiter')
        .eq('active', true)

      if (currentAthleteIds.length > 0) {
        staleQuery = staleQuery.not('athlete_id', 'in', `(${currentAthleteIds.join(',')})`)
      }

      const { data: staleEntries, error: staleError } = await staleQuery
      if (staleError) {
        errors.push(`${team.team_name} roster cleanup: ${staleError.message}`)
      } else if (staleEntries && staleEntries.length > 0) {
        let deactivateQuery = supabase
          .from('roster_entries')
          .update({ active: false, updated_at: now })
          .eq('team_id', payload.team_id)
          .eq('season_id', payload.season_id)
          .eq('source', 'arbiter')
          .eq('active', true)

        if (currentAthleteIds.length > 0) {
          deactivateQuery = deactivateQuery.not('athlete_id', 'in', `(${currentAthleteIds.join(',')})`)
        }

        const { error: deactivateError } = await deactivateQuery
        if (deactivateError) errors.push(`${team.team_name} roster cleanup: ${deactivateError.message}`)
        else rosterDeactivated = staleEntries.length
      }
    }
  }

  if (payload.coaches_found === true) {
    const coachRows = dedupePeople(payload.coaches || [])
    const coachResults = await mapBounded(coachRows, PERSON_CONCURRENCY, async raw => {
      try {
        const displayName = cleanText(raw.displayName)
        if (!displayName) return null

        const coachId = await findOrCreateCoach(supabase, {
          schoolId: school.id,
          schoolSlug: school.slug || slugify(school.school_name),
          displayName,
          firstName: cleanText(raw.firstName),
          lastName: cleanText(raw.lastName),
          sourceUrl,
        })

        const { error: upsertError } = await supabase
          .from('team_coaches')
          .upsert({
            coach_id: coachId,
            team_id: payload.team_id,
            season_id: payload.season_id,
            title: cleanText(raw.title) || null,
            source: 'arbiter',
            source_url: sourceUrl,
            active: true,
            imported_at: now,
            updated_at: now,
          }, { onConflict: 'team_id,season_id,coach_id' })

        if (upsertError) throw new Error(upsertError.message)
        return coachId
      } catch (error: any) {
        errors.push(`${team.team_name} coach: ${error?.message || 'Unknown error'}`)
        return null
      }
    })

    const currentCoachIds = coachResults.filter(Boolean) as string[]
    coachesImported = currentCoachIds.length

    if (errors.filter(error => error.startsWith(`${team.team_name} coach:`)).length === 0) {
      let staleQuery = supabase
        .from('team_coaches')
        .select('id')
        .eq('team_id', payload.team_id)
        .eq('season_id', payload.season_id)
        .eq('source', 'arbiter')
        .eq('active', true)

      if (currentCoachIds.length > 0) {
        staleQuery = staleQuery.not('coach_id', 'in', `(${currentCoachIds.join(',')})`)
      }

      const { data: staleEntries, error: staleError } = await staleQuery
      if (staleError) {
        errors.push(`${team.team_name} coach cleanup: ${staleError.message}`)
      } else if (staleEntries && staleEntries.length > 0) {
        let deactivateQuery = supabase
          .from('team_coaches')
          .update({ active: false, updated_at: now })
          .eq('team_id', payload.team_id)
          .eq('season_id', payload.season_id)
          .eq('source', 'arbiter')
          .eq('active', true)

        if (currentCoachIds.length > 0) {
          deactivateQuery = deactivateQuery.not('coach_id', 'in', `(${currentCoachIds.join(',')})`)
        }

        const { error: deactivateError } = await deactivateQuery
        if (deactivateError) errors.push(`${team.team_name} coach cleanup: ${deactivateError.message}`)
        else coachesDeactivated = staleEntries.length
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
    const teams: TeamRosterPayload[] = Array.isArray(body?.teams)
      ? body.teams
      : body?.team_id
        ? [body]
        : []

    if (teams.length === 0) {
      return NextResponse.json({ error: 'At least one team roster payload is required.' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const results = []
    const errors: string[] = []
    let rosterImported = 0
    let coachesImported = 0

    // Callers group teams by school. Keep teams within a school sequential so
    // the same student appearing in multiple sports cannot race person creation.
    for (const team of teams) {
      try {
        const result = await syncOneTeam(supabase, team)
        results.push(result)
        rosterImported += result.rosterImported
        coachesImported += result.coachesImported
        errors.push(...result.errors)
      } catch (error: any) {
        errors.push(error?.message || 'Team roster sync failed.')
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      teamsProcessed: results.length,
      rosterImported,
      coachesImported,
      results,
      errors,
    })
  } catch (error: any) {
    console.error('Arbiter roster publish error:', error)
    return NextResponse.json(
      { error: error?.message || 'Could not publish Arbiter roster data.' },
      { status: 500 }
    )
  }
}
