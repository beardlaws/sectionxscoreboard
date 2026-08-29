import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { arbiterApi } from '@/lib/arbiter/client'
import { POST as importRosters } from '@/app/api/admin/arbiter-rosters/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const REPAIR_KEY = 'sx-roster-repair-20260828-7f3c91'
const BATCH_SIZE = 4
const IMPORT_SCHOOL_CONCURRENCY = 4
const POLICY = 'current-academic-year-roster-instance-v11'
const nowIso = () => new Date().toISOString()
const clean = (v: unknown) => String(v ?? '').trim()
const norm = (v: unknown) => clean(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

type ArrayContext = { values: any[]; path: string[]; ancestors: any[] }
type SeasonEvidence = { key: string; value: string; scope: number }
type MarkerClass = 'current' | 'prior' | 'unknown'
type ContextClass = 'current' | 'prior' | 'ambiguous' | 'unknown'

function findNamedArrayContexts(root: any, names: string[]): ArrayContext[] {
  const wanted = new Set(names.map(norm))
  const seen = new Set<any>()
  const queue: Array<{ value: any; path: string[]; ancestors: any[] }> = [{ value: root, path: [], ancestors: [] }]
  const found: ArrayContext[] = []

  while (queue.length) {
    const item = queue.shift()!
    const cur = item.value
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue
    seen.add(cur)

    for (const [key, value] of Object.entries(cur)) {
      if (wanted.has(norm(key)) && Array.isArray(value)) {
        found.push({ values: value as any[], path: [...item.path, key], ancestors: [cur, ...item.ancestors] })
      }
      if (value && typeof value === 'object') {
        queue.push({ value, path: [...item.path, key], ancestors: [cur, ...item.ancestors] })
      }
    }
  }

  return found
}

function fullName(p: any) {
  return clean(p?.displayName || p?.fullName || p?.name || [p?.firstName, p?.lastName].filter(Boolean).join(' '))
}

function player(p: any) {
  const displayName = fullName(p)
  return {
    jerseyNumber: clean(p?.jerseyNumber || p?.jersey || p?.number),
    rawName: displayName,
    displayName,
    firstName: clean(p?.firstName),
    lastName: clean(p?.lastName),
    classYear: clean(p?.classYear || p?.class || p?.grade || p?.graduationYear),
    position: clean(p?.position || p?.positionName),
    height: clean(p?.height),
  }
}

function coach(p: any) {
  const displayName = fullName(p)
  return {
    rawName: displayName,
    displayName,
    firstName: clean(p?.firstName),
    lastName: clean(p?.lastName),
    title: clean(p?.title || p?.role || p?.position),
  }
}

function directSeasonEvidence(ancestors: any[]): SeasonEvidence[] {
  const evidence: SeasonEvidence[] = []
  const keys = new Set(['season', 'seasonname', 'schoolyear', 'academicyear', 'seasonyear'])

  ancestors.slice(0, 5).forEach((obj, scope) => {
    if (!obj || typeof obj !== 'object') return
    for (const [key, value] of Object.entries(obj)) {
      if (!keys.has(norm(key).replace(/ /g, ''))) continue
      if (typeof value !== 'string' && typeof value !== 'number') continue
      const text = clean(value)
      if (text) evidence.push({ key, value: text, scope })
    }
  })

  return evidence.filter(
    (item, index, all) =>
      all.findIndex(
        other => norm(other.key) === norm(item.key) && other.value === item.value && other.scope === item.scope
      ) === index
  )
}

function academicYear(season: any) {
  const year = Number(season.year)
  const type = norm(season.season_type)
  const start = type === 'spring' ? year - 1 : year
  return { start, end: start + 1 }
}

function markerClass(marker: SeasonEvidence, season: any): MarkerClass {
  const { start: currentStart, end: currentEnd } = academicYear(season)
  const priorStart = currentStart - 1
  const priorEnd = currentEnd - 1
  const text = marker.value.replace(/[–—]/g, '-')
  const key = norm(marker.key).replace(/ /g, '')

  const pair = text.match(/\b(20\d{2})\s*[-/]\s*(\d{2}|20\d{2})\b/)
  if (pair) {
    const start = Number(pair[1])
    const end = pair[2].length === 2 ? Number(String(start).slice(0, 2) + pair[2]) : Number(pair[2])
    if (start === currentStart && end === currentEnd) return 'current'
    if (start === priorStart && end === priorEnd) return 'prior'
    return 'unknown'
  }

  const years = text.match(/20\d{2}/g)?.map(Number) || []
  if (years.length !== 1) return 'unknown'

  const year = years[0]
  const isSyLabel = /\bsy\s*20\d{2}\b/i.test(text)
  const isAcademicYearKey = ['schoolyear', 'academicyear', 'seasonyear'].includes(key)

  // Arbiter's `SY 2026` denotes the school year ending in 2026 (2025-26),
  // while our Fall/Winter season.year stores the academic-year start (2026 for 2026-27).
  if (isSyLabel) {
    if (year === currentEnd) return 'current'
    if (year === priorEnd) return 'prior'
    return 'unknown'
  }

  // A bare school-year-style year is ambiguous across providers. Treat it as
  // an ending year first because that matches Arbiter's current payload shape.
  if (isAcademicYearKey) {
    if (year === currentEnd) return 'current'
    if (year === priorEnd) return 'prior'
  }

  return 'unknown'
}

function classifyContext(context: ArrayContext, season: any): { classification: ContextClass; evidence: SeasonEvidence[]; nearestScope: number | null } {
  const evidence = directSeasonEvidence(context.ancestors)
  const classified = evidence.map(item => ({ item, cls: markerClass(item, season) })).filter(x => x.cls !== 'unknown')
  const nearestScope = classified.length ? Math.min(...classified.map(x => x.item.scope)) : null
  const nearest = nearestScope === null ? [] : classified.filter(x => x.item.scope === nearestScope)
  const hasCurrent = nearest.some(x => x.cls === 'current')
  const hasPrior = nearest.some(x => x.cls === 'prior')

  if (hasCurrent && !hasPrior) return { classification: 'current', evidence, nearestScope }
  if (hasPrior && !hasCurrent) return { classification: 'prior', evidence, nearestScope }
  if (hasCurrent && hasPrior) return { classification: 'ambiguous', evidence, nearestScope }
  return { classification: 'unknown', evidence, nearestScope }
}

function selectNamedArrayContext(root: any, names: string[], season: any): ArrayContext | null {
  const contexts = findNamedArrayContexts(root, names)
  if (!contexts.length) return null

  const ranked = contexts.map((context, index) => {
    const meta = classifyContext(context, season)
    const rank = meta.classification === 'current' ? 4 : meta.classification === 'unknown' ? 3 : meta.classification === 'ambiguous' ? 2 : 1
    return { context, index, rank, count: context.values.length }
  })

  ranked.sort((a, b) => b.rank - a.rank || Number(b.count > 0) - Number(a.count > 0) || b.count - a.count || a.index - b.index)
  return ranked[0].context
}

function overlap(incoming: string[], previous: string[]) {
  const a = new Set(incoming.map(norm).filter(Boolean))
  const b = new Set(previous.map(norm).filter(Boolean))
  if (!a.size || !b.size) return 0
  let matches = 0
  for (const name of a) if (b.has(name)) matches++
  return matches / Math.min(a.size, b.size)
}

function freshness(roster: any[], previousNames: string[], season: any, rosterContext: ArrayContext | null) {
  const contextMeta = rosterContext ? classifyContext(rosterContext, season) : { classification: 'unknown' as ContextClass, evidence: [] as SeasonEvidence[], nearestScope: null as number | null }
  const evidence = contextMeta.evidence
  const names = roster.map(r => r.displayName).filter(Boolean)
  const priorOverlap = overlap(names, previousNames)
  const exactPriorCarryover = previousNames.length >= 5 && names.length === previousNames.length && priorOverlap >= 0.95

  if (!names.length) {
    return {
      status: 'awaiting-current-roster',
      verified: false,
      reason: 'Arbiter has not published a non-empty roster.',
      evidence,
      priorOverlap,
      classification: 'awaiting-current-roster',
    }
  }

  if (exactPriorCarryover) {
    return {
      status: 'review-needed',
      verified: false,
      reason: 'Incoming roster is essentially identical to the previous season and is held to prevent stale carryover.',
      evidence,
      priorOverlap,
      classification: 'possible-prior-season-roster',
    }
  }

  if (contextMeta.classification === 'current') {
    return {
      status: 'current-verified',
      verified: true,
      reason: `Selected roster instance has nearest Arbiter metadata matching the active academic year at scope ${contextMeta.nearestScope}.`,
      evidence,
      priorOverlap,
      classification: 'current-academic-year-instance',
    }
  }

  if (contextMeta.classification === 'prior') {
    return {
      status: 'review-needed',
      verified: false,
      reason: `Selected roster instance points to the prior academic year at scope ${contextMeta.nearestScope}.`,
      evidence,
      priorOverlap,
      classification: 'prior-season-roster',
    }
  }

  if (contextMeta.classification === 'ambiguous') {
    return {
      status: 'review-needed',
      verified: false,
      reason: `Selected roster instance has conflicting current/prior academic-year metadata at scope ${contextMeta.nearestScope}.`,
      evidence,
      priorOverlap,
      classification: 'mixed-nearest-season-evidence',
    }
  }

  return {
    status: 'current-verified',
    verified: true,
    reason: 'Non-empty roster returned from the stable current-season Arbiter team identity with no prior-year marker or exact prior-season carryover.',
    evidence,
    priorOverlap,
    classification: 'current-linked-team-roster',
  }
}

async function updateRun(db: any, runId: string | null, patch: any, status?: string, finished = false) {
  if (!runId) return
  const payload: any = { summary: patch }
  if (status) payload.status = status
  if (finished) payload.finished_at = nowIso()
  await db.from('arbiter_roster_automation_runs').update(payload).eq('id', runId)
}

export async function GET(req: NextRequest) {
  const db = createAdminClient()
  const internalRepair = req.headers.get('x-sectionx-internal-repair') === REPAIR_KEY

  if (!internalRepair) {
    const token = req.headers.get('x-sectionx-automation-key') || ''
    const { data: allowed, error: authError } = await db.rpc('verify_sectionx_automation_key', { p_token: token })
    if (authError || allowed !== true) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let runId: string | null = null
  let runSummary: any = {
    scanned: 0,
    teamsUpdated: 0,
    verified: 0,
    quarantined: 0,
    failed: 0,
    actions: [],
    quarantines: [],
    failures: [],
    statuses: {},
    progress: { phase: 'starting', processed: 0, total: 0, batchSize: BATCH_SIZE, heartbeatAt: nowIso() },
  }

  try {
    const { data: run, error: runError } = await db
      .from('arbiter_roster_automation_runs')
      .insert({ status: 'running', trigger_source: internalRepair ? 'emergency-repair' : 'supabase-roster-cron', summary: runSummary })
      .select('id')
      .single()
    if (!runError && run?.id) runId = run.id

    const { data: season, error: seasonError } = await db
      .from('seasons')
      .select('id,name,season_type,year,is_active')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    if (seasonError || !season) throw new Error(seasonError?.message || 'No active season found.')

    const { data: previousSeason } = await db
      .from('seasons')
      .select('id,name,season_type,year')
      .eq('season_type', season.season_type)
      .eq('year', Number(season.year) - 1)
      .limit(1)
      .maybeSingle()

    const [{ data: teamSeasons }, { data: teams }, { data: links }] = await Promise.all([
      db.from('team_seasons').select('team_id').eq('season_id', season.id).eq('active_for_season', true),
      db.from('teams').select('id,team_name,level,active,school_id').eq('active', true),
      db.from('arbiter_team_links').select('team_id,arbiter_team_id,arbiter_school_id,last_seen_at'),
    ])

    const active = new Set((teamSeasons || []).map((x: any) => x.team_id))
    const varsity = (teams || []).filter((t: any) => active.has(t.id) && norm(t.level).includes('varsity') && !norm(t.level).includes('junior'))
    const linkMap = new Map((links || []).map((l: any) => [l.team_id, l]))
    const teamIds = varsity.map((t: any) => t.id)

    const { data: previousRows } = previousSeason && teamIds.length
      ? await db.from('roster_entries').select('team_id,athlete:athletes(display_name)').eq('season_id', previousSeason.id).eq('active', true).in('team_id', teamIds)
      : { data: [] as any[] }

    const previousByTeam = new Map<string, string[]>()
    for (const row of previousRows || []) {
      const athlete = Array.isArray((row as any).athlete) ? (row as any).athlete[0] : (row as any).athlete
      const list = previousByTeam.get((row as any).team_id) || []
      if (athlete?.display_name) list.push(athlete.display_name)
      previousByTeam.set((row as any).team_id, list)
    }

    runSummary = {
      ...runSummary,
      season: season.name,
      previousSeason: previousSeason?.name || null,
      policy: POLICY,
      progress: { ...runSummary.progress, phase: 'scanning', total: varsity.length, heartbeatAt: nowIso() },
    }
    await updateRun(db, runId, runSummary)

    const audits: any[] = []
    const verifiedPayloads: any[] = []
    const failures: any[] = []
    const quarantines: any[] = []

    for (let i = 0; i < varsity.length; i += BATCH_SIZE) {
      const slice = varsity.slice(i, i + BATCH_SIZE)
      const results = await Promise.all(
        slice.map(async (team: any) => {
          const link: any = linkMap.get(team.id)
          if (!link) return { team, error: 'No stable Arbiter team link.' }
          try {
            return {
              team,
              link,
              payload: await arbiterApi.teamWithRoster(Number(link.arbiter_team_id), Number(link.arbiter_school_id) || undefined),
            }
          } catch (e) {
            return { team, link, error: e instanceof Error ? e.message : String(e) }
          }
        })
      )

      for (const item of results) {
        if (item.error) {
          failures.push({ teamId: item.team.id, teamName: item.team.team_name, error: item.error })
          continue
        }

        const rosterContext = selectNamedArrayContext(item.payload, ['roster', 'rosters', 'players', 'athletes', 'studentAthletes'], season)
        const coachesContext = selectNamedArrayContext(item.payload, ['coaches', 'coachingStaff', 'staff'], season)
        const roster = (rosterContext?.values || []).map(player).filter((p: any) => p.displayName)
        const coaches = (coachesContext?.values || []).map(coach).filter((p: any) => p.displayName)
        const check = freshness(roster, previousByTeam.get(item.team.id) || [], season, rosterContext)

        audits.push({
          team_id: item.team.id,
          season_id: season.id,
          arbiter_team_id: Number(item.link.arbiter_team_id),
          status: check.verified ? 'current-verified' : check.status,
          verified: check.verified,
          reason: check.reason,
          incoming_count: roster.length,
          previous_count: (previousByTeam.get(item.team.id) || []).length,
          previous_overlap: Number(check.priorOverlap.toFixed(4)),
          evidence: {
            policy: POLICY,
            rosterPath: rosterContext?.path || null,
            seasonFields: check.evidence,
            classification: check.classification || check.status,
            academicYear: academicYear(season),
          },
          checked_at: nowIso(),
        })

        if (check.verified) {
          verifiedPayloads.push({
            team_id: item.team.id,
            school_id: item.team.school_id,
            season_id: season.id,
            source_url: null,
            roster_found: rosterContext !== null,
            coaches_found: coachesContext !== null,
            roster,
            coaches,
          })
        } else {
          quarantines.push({
            teamId: item.team.id,
            teamName: item.team.team_name,
            area: 'roster',
            reason: check.classification || check.status,
            incomingCount: roster.length,
            currentCount: (previousByTeam.get(item.team.id) || []).length,
            detail: check.reason,
          })
        }
      }

      runSummary = {
        ...runSummary,
        scanned: Math.min(i + slice.length, varsity.length),
        verified: verifiedPayloads.length,
        quarantined: quarantines.length,
        failed: failures.length,
        quarantines: quarantines.slice(-100),
        failures: failures.slice(-100),
        progress: {
          ...runSummary.progress,
          phase: 'scanning',
          processed: Math.min(i + slice.length, varsity.length),
          total: varsity.length,
          heartbeatAt: nowIso(),
        },
      }
      await updateRun(db, runId, runSummary)
    }

    if (audits.length) {
      const { error: auditError } = await db.from('arbiter_roster_freshness').upsert(audits, { onConflict: 'team_id,season_id' })
      if (auditError) throw new Error(`Roster freshness audit write failed: ${auditError.message}`)
    }

    let imported = 0
    let actions: any[] = []

    if (verifiedPayloads.length) {
      runSummary = {
        ...runSummary,
        progress: { ...runSummary.progress, phase: 'importing', processed: 0, importTotal: verifiedPayloads.length, heartbeatAt: nowIso() },
      }
      await updateRun(db, runId, runSummary)

      const bySchool = new Map<string, any[]>()
      for (const payload of verifiedPayloads) {
        const key = clean(payload.school_id) || payload.team_id
        const group = bySchool.get(key) || []
        group.push(payload)
        bySchool.set(key, group)
      }

      const schoolGroups = [...bySchool.values()]
      const allResults: any[] = []

      for (let i = 0; i < schoolGroups.length; i += IMPORT_SCHOOL_CONCURRENCY) {
        const wave = schoolGroups.slice(i, i + IMPORT_SCHOOL_CONCURRENCY)
        const waveResults = await Promise.all(
          wave.map(async group => {
            const importReq = new NextRequest('http://sectionx.internal/api/admin/arbiter-rosters', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ teams: group }),
            })
            const response = await importRosters(importReq)
            const result: any = await response.json()
            if (!response.ok || result?.success === false) {
              throw new Error(result?.error || 'Verified roster import failed.')
            }
            return Array.isArray(result?.results) ? result.results : []
          })
        )

        const completedResults = waveResults.flat()
        allResults.push(...completedResults)
        imported = allResults.length
        runSummary = {
          ...runSummary,
          teamsUpdated: imported,
          progress: {
            ...runSummary.progress,
            phase: 'importing',
            processed: imported,
            importTotal: verifiedPayloads.length,
            heartbeatAt: nowIso(),
          },
        }
        await updateRun(db, runId, runSummary)
      }

      actions = allResults.map((x: any) => ({
        teamId: x.team_id || x.teamId,
        rosterImported: x.rosterImported ?? null,
        rosterDeactivated: x.rosterDeactivated ?? null,
        coachesImported: x.coachesImported ?? null,
        coachesDeactivated: x.coachesDeactivated ?? null,
        errors: x.errors || [],
      }))
    }

    const statuses = audits.reduce((acc: any, a: any) => {
      acc[a.status] = (acc[a.status] || 0) + 1
      return acc
    }, {})

    runSummary = {
      ...runSummary,
      scanned: varsity.length,
      teamsUpdated: imported,
      verified: verifiedPayloads.length,
      quarantined: quarantines.length,
      failed: failures.length,
      actions,
      quarantines: quarantines.slice(-100),
      failures: failures.slice(-100),
      statuses,
      progress: { ...runSummary.progress, phase: 'completed', processed: varsity.length, total: varsity.length, heartbeatAt: nowIso() },
    }

    const finalStatus = failures.length ? 'completed-with-errors' : 'completed'
    await updateRun(db, runId, runSummary, finalStatus, true)

    return NextResponse.json({
      ok: true,
      runId,
      season: season.name,
      previousSeason: previousSeason?.name || null,
      policy: POLICY,
      scanned: varsity.length,
      verified: verifiedPayloads.length,
      held: quarantines.length,
      imported,
      failures,
      statuses,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Roster freshness automation failed:', error)
    runSummary = {
      ...runSummary,
      failed: Number(runSummary.failed || 0) + 1,
      failures: [...(runSummary.failures || []), { message }].slice(-100),
      progress: { ...(runSummary.progress || {}), phase: 'failed', heartbeatAt: nowIso() },
      error: message,
    }
    await updateRun(db, runId, runSummary, 'failed', true)
    return NextResponse.json({ ok: false, error: message, runId }, { status: 500 })
  }
}
