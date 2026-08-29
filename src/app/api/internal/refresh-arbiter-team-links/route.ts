import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { arbiterApi } from '@/lib/arbiter/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const REPAIR_KEY = 'sx-roster-repair-20260828-7f3c91'
const clean = (v: unknown) => String(v ?? '').trim()
const norm = (v: unknown) => clean(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
const arr = (v: any): any[] => Array.isArray(v) ? v : v == null ? [] : [v]

function varsityLevel(v: unknown) {
  const x = norm(v)
  return x.includes('varsity') && !x.includes('junior')
}

function normalizeSport(v: unknown) {
  return norm(v)
    .replace(/\b(girls|boys|mens|womens|male|female)\b/g, '')
    .replace(/association football/g, 'soccer')
    .replace(/crosscountry/g, 'cross country')
    .replace(/volley ball/g, 'volleyball')
    .replace(/\s+/g, ' ')
    .trim()
}

function sportEquivalent(a: unknown, b: unknown) {
  const x = normalizeSport(a)
  const y = normalizeSport(b)
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)))
}

function genderCompatible(candidate: unknown, target: unknown, teamName: unknown = '') {
  const cg = norm(candidate)
  const tg = norm(target)
  const tn = norm(teamName)
  if (!tg) return true
  if (cg) {
    if (cg === tg || cg.startsWith(tg) || tg.startsWith(cg)) return true
    if ((cg === 'm' || cg.includes('male') || cg.includes('boy')) && (tg === 'm' || tg.includes('male') || tg.includes('boy'))) return true
    if ((cg === 'f' || cg.includes('female') || cg.includes('girl')) && (tg === 'f' || tg.includes('female') || tg.includes('girl'))) return true
    return false
  }
  if (tn.includes('boys') || tn.includes('mens')) return tg.includes('boy') || tg.includes('men') || tg.includes('male') || tg === 'm'
  if (tn.includes('girls') || tn.includes('womens')) return tg.includes('girl') || tg.includes('women') || tg.includes('female') || tg === 'f'
  return true
}

function seasonWindow(season: any) {
  const type = norm(season.season_type)
  const year = Number(season.year)
  if (type === 'winter') return { start: `${year}-11-01T00:00:00.000Z`, end: `${year + 1}-03-31T23:59:59.999Z` }
  if (type === 'spring') return { start: `${year}-03-01T00:00:00.000Z`, end: `${year}-06-30T23:59:59.999Z` }
  return { start: `${year}-08-01T00:00:00.000Z`, end: `${year}-11-30T23:59:59.999Z` }
}

function scheduleObservations(raw: any) {
  const observations: any[] = []
  for (const game of arr(raw)) {
    const sportName = clean(game?.sportName)
    const gender = clean(game?.gender)
    const level = clean(game?.levelName)
    if (!varsityLevel(level)) continue
    for (const team of arr(game?.teams)) {
      const teamId = Number(team?.teamId)
      const schoolId = Number(team?.schoolId)
      if (!Number.isFinite(teamId) || !Number.isFinite(schoolId) || !teamId || !schoolId) continue
      observations.push({
        teamId,
        schoolId,
        teamName: clean(team?.teamName),
        schoolName: clean(team?.schoolName),
        sportName,
        gender,
        level,
        gameId: Number(team?.uniqueGameId || game?.uniqueGameId) || null,
      })
    }
  }
  return observations
}

function varsitySchoolIds(varsity: any[], schoolById: Map<any, any>) {
  return varsity
    .map((team: any) => Number((schoolById.get(team.school_id) as any)?.arbiter_entity_id))
    .filter((id: number) => Number.isFinite(id) && id > 0)
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== REPAIR_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  try {
    const { data: season, error: seasonError } = await db
      .from('seasons')
      .select('id,name,season_type,year,is_active')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (seasonError || !season) throw new Error(seasonError?.message || 'No active season found.')

    const [{ data: teamSeasons, error: tsError }, { data: teams, error: teamsError }, { data: schools, error: schoolsError }, { data: sports, error: sportsError }, { data: existingLinks, error: linksError }] = await Promise.all([
      db.from('team_seasons').select('team_id').eq('season_id', season.id).eq('active_for_season', true),
      db.from('teams').select('id,school_id,sport_id,team_name,level,active').eq('active', true),
      db.from('schools').select('id,school_name,arbiter_entity_id').eq('active', true).not('arbiter_entity_id', 'is', null),
      db.from('sports').select('id,sport_name,gender,season_type,slug'),
      db.from('arbiter_team_links').select('team_id,arbiter_team_id,arbiter_school_id,observed_count'),
    ])
    const firstError = tsError || teamsError || schoolsError || sportsError || linksError
    if (firstError) throw new Error(firstError.message)

    const activeTeamIds = new Set((teamSeasons || []).map((x: any) => x.team_id))
    const varsity = (teams || []).filter((t: any) => activeTeamIds.has(t.id) && varsityLevel(t.level))
    const schoolById = new Map((schools || []).map((s: any) => [s.id, s]))
    const sportById = new Map((sports || []).map((s: any) => [s.id, s]))
    const existingByTeam = new Map((existingLinks || []).map((l: any) => [l.team_id, l]))
    const arbiterSchoolIds = [...new Set(varsit ySchoolIds(varsity, schoolById))]

    const window = seasonWindow(season)
    const gameRaw = arbiterSchoolIds.length
      ? await arbiterApi.games({
          SchoolIds: arbiterSchoolIds,
          DateFilter: 'Range',
          GameStartDate: window.start,
          GameEndDate: window.end,
          IncludeDeletedGames: false,
          IncludePendingInformation: false,
        })
      : []
    const observations = scheduleObservations(gameRaw)

    const updates: any[] = []
    const held: any[] = []

    for (const team of varsity) {
      const school: any = schoolById.get(team.school_id)
      const sport: any = sportById.get(team.sport_id)
      const schoolId = Number(school?.arbiter_entity_id)
      if (!schoolId || !sport) {
        held.push({ teamId: team.id, teamName: team.team_name, reason: 'missing-school-or-sport-mapping' })
        continue
      }

      const compatible = observations.filter(o =>
        o.schoolId === schoolId &&
        sportEquivalent(o.sportName || o.teamName, sport.sport_name) &&
        genderCompatible(o.gender, sport.gender, o.teamName) &&
        varsityLevel(o.level)
      )
      const byId = new Map<number, any>()
      for (const o of compatible) if (!byId.has(o.teamId)) byId.set(o.teamId, o)

      if (byId.size !== 1) {
        held.push({
          teamId: team.id,
          teamName: team.team_name,
          school: school.school_name,
          sport: sport.sport_name,
          reason: byId.size === 0 ? 'no-current-season-schedule-team-id' : 'multiple-current-season-schedule-team-ids',
          observedTeamIds: [...byId.keys()],
        })
        continue
      }

      const observation = [...byId.values()][0]
      const previous: any = existingByTeam.get(team.id)
      updates.push({
        team_id: team.id,
        arbiter_team_id: observation.teamId,
        arbiter_school_id: schoolId,
        source: 'current-season-schedule-observation',
        confidence: 'stable',
        observed_count: Number(previous?.observed_count || 0) + compatible.length,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    let written = 0
    const writeFailures: any[] = []
    for (const row of updates) {
      const { error } = await db.from('arbiter_team_links').upsert(row, { onConflict: 'team_id' })
      if (error) writeFailures.push({ teamId: row.team_id, arbiterTeamId: row.arbiter_team_id, error: error.message })
      else written++
    }

    return NextResponse.json({
      ok: writeFailures.length === 0,
      season: season.name,
      scanned: varsity.length,
      scheduleObservations: observations.length,
      uniqueArbiterSchoolIds: arbiterSchoolIds.length,
      matched: updates.length,
      written,
      held: held.length,
      heldDetails: held.slice(0, 100),
      writeFailures,
      sampleUpdates: updates.slice(0, 20).map(x => ({ teamId: x.team_id, arbiterTeamId: x.arbiter_team_id, arbiterSchoolId: x.arbiter_school_id })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
