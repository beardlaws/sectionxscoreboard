import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { arbiterApi } from '@/lib/arbiter/client'
import { POST as importRosters } from '@/app/api/admin/arbiter-rosters/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const clean = (v: unknown) => String(v ?? '').trim()
const norm = (v: unknown) => clean(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
const arr = (v: any): any[] => Array.isArray(v) ? v : v == null ? [] : [v]

function findNamedArray(root: any, names: string[]) {
  const wanted = new Set(names.map(norm)), seen = new Set<any>(), queue = [root]
  while (queue.length) {
    const cur = queue.shift()
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue
    seen.add(cur)
    for (const [key, value] of Object.entries(cur)) {
      if (wanted.has(norm(key)) && Array.isArray(value)) return value as any[]
      if (value && typeof value === 'object') queue.push(value)
    }
  }
  return null
}

function fullName(p: any) { return clean(p?.displayName || p?.fullName || p?.name || [p?.firstName, p?.lastName].filter(Boolean).join(' ')) }
function player(p: any) { const displayName = fullName(p); return { jerseyNumber: clean(p?.jerseyNumber || p?.jersey || p?.number), rawName: displayName, displayName, firstName: clean(p?.firstName), lastName: clean(p?.lastName), classYear: clean(p?.classYear || p?.class || p?.grade || p?.graduationYear), position: clean(p?.position || p?.positionName), height: clean(p?.height) } }
function coach(p: any) { const displayName = fullName(p); return { rawName: displayName, displayName, firstName: clean(p?.firstName), lastName: clean(p?.lastName), title: clean(p?.title || p?.role || p?.position) } }

function collectSeasonEvidence(root: any) {
  const evidence: string[] = [], seen = new Set<any>(), queue = [root]
  const keys = new Set(['season','seasonname','schoolyear','academicyear','year','seasonyear'])
  while (queue.length && evidence.length < 30) {
    const cur = queue.shift()
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue
    seen.add(cur)
    for (const [key, value] of Object.entries(cur)) {
      if (keys.has(norm(key).replace(/ /g,'')) && (typeof value === 'string' || typeof value === 'number')) evidence.push(clean(value))
      if (value && typeof value === 'object') queue.push(value)
    }
  }
  return [...new Set(evidence.filter(Boolean))]
}

function evidenceYear(value: string) {
  const years = value.match(/20\d{2}/g)?.map(Number) || []
  return years
}

function overlap(incoming: string[], previous: string[]) {
  const a = new Set(incoming.map(norm).filter(Boolean)), b = new Set(previous.map(norm).filter(Boolean))
  if (!a.size || !b.size) return 0
  let matches = 0
  for (const name of a) if (b.has(name)) matches++
  return matches / Math.min(a.size, b.size)
}

function freshness(payload: any, roster: any[], previousNames: string[], season: any) {
  const target = Number(season.year), evidence = collectSeasonEvidence(payload), years = [...new Set(evidence.flatMap(evidenceYear))]
  const explicitCurrent = years.includes(target) || (season.season_type === 'winter' && years.includes(target + 1))
  const explicitPrior = years.length > 0 && !explicitCurrent && years.every(y => y < target)
  const names = roster.map(r => r.displayName).filter(Boolean)
  const priorOverlap = overlap(names, previousNames)
  const classYears = roster.flatMap(r => evidenceYear(clean(r.classYear)))
  const hasGraduatedClass = classYears.some(y => y <= target)
  const exactPriorCarryover = previousNames.length >= 5 && names.length === previousNames.length && priorOverlap >= 0.95

  if (!names.length) return { status: 'awaiting-current-roster', verified: false, reason: 'Arbiter has not published a non-empty roster.', evidence, priorOverlap }
  if (explicitPrior) return { status: 'prior-season-roster', verified: false, reason: 'Arbiter roster metadata points to a prior season.', evidence, priorOverlap }
  if (hasGraduatedClass && !explicitCurrent) return { status: 'possible-prior-season-roster', verified: false, reason: `Roster contains a class year that should already be graduated for ${season.name}.`, evidence, priorOverlap }
  if (exactPriorCarryover && !explicitCurrent) return { status: 'possible-prior-season-roster', verified: false, reason: 'Incoming roster is essentially identical to the previous season and has no current-season marker.', evidence, priorOverlap }
  if (explicitCurrent) return { status: 'current-verified', verified: true, reason: 'Arbiter payload contains current-season evidence.', evidence, priorOverlap }
  if (previousNames.length === 0) return { status: 'review-needed', verified: false, reason: 'No prior roster exists for comparison and Arbiter supplied no current-season marker.', evidence, priorOverlap }
  if (priorOverlap < 0.95) return { status: 'current-probable', verified: true, reason: 'Roster materially differs from the previous season and has no stale-season indicators.', evidence, priorOverlap }
  return { status: 'review-needed', verified: false, reason: 'Roster freshness cannot be established safely.', evidence, priorOverlap }
}

export async function GET(req: NextRequest) {
  const db = createAdminClient()
  const token = req.headers.get('x-sectionx-automation-key') || ''
  const { data: allowed, error: authError } = await db.rpc('verify_sectionx_automation_key', { p_token: token })
  if (authError || allowed !== true) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const { data: season, error: seasonError } = await db.from('seasons').select('id,name,season_type,year,is_active').eq('is_active', true).limit(1).maybeSingle()
    if (seasonError || !season) throw new Error(seasonError?.message || 'No active season found.')
    const { data: previousSeason } = await db.from('seasons').select('id,name,season_type,year').eq('season_type', season.season_type).eq('year', Number(season.year) - 1).limit(1).maybeSingle()
    const [{ data: teamSeasons }, { data: teams }, { data: links }] = await Promise.all([
      db.from('team_seasons').select('team_id').eq('season_id', season.id).eq('active_for_season', true),
      db.from('teams').select('id,team_name,level,active').eq('active', true),
      db.from('arbiter_team_links').select('team_id,arbiter_team_id,arbiter_school_id,last_seen_at')
    ])
    const active = new Set((teamSeasons || []).map((x: any) => x.team_id))
    const varsity = (teams || []).filter((t: any) => active.has(t.id) && norm(t.level).includes('varsity') && !norm(t.level).includes('junior'))
    const linkMap = new Map((links || []).map((l: any) => [l.team_id, l]))
    const teamIds = varsity.map((t: any) => t.id)
    const { data: previousRows } = previousSeason && teamIds.length ? await db.from('roster_entries').select('team_id,athlete:athletes(display_name)').eq('season_id', previousSeason.id).eq('active', true).in('team_id', teamIds) : { data: [] as any[] }
    const previousByTeam = new Map<string,string[]>()
    for (const row of previousRows || []) { const athlete = Array.isArray((row as any).athlete) ? (row as any).athlete[0] : (row as any).athlete; const list = previousByTeam.get((row as any).team_id) || []; if (athlete?.display_name) list.push(athlete.display_name); previousByTeam.set((row as any).team_id, list) }

    const audits: any[] = [], verifiedPayloads: any[] = [], failures: any[] = []
    for (let i = 0; i < varsity.length; i += 4) {
      const slice = varsity.slice(i, i + 4)
      const results = await Promise.all(slice.map(async (team: any) => {
        const link: any = linkMap.get(team.id)
        if (!link) return { team, error: 'No stable Arbiter team link.' }
        try { return { team, link, payload: await arbiterApi.teamWithRoster(Number(link.arbiter_team_id), Number(link.arbiter_school_id) || undefined) } }
        catch (e) { return { team, link, error: e instanceof Error ? e.message : String(e) } }
      }))
      for (const item of results) {
        if (item.error) { failures.push({ teamId: item.team.id, teamName: item.team.team_name, error: item.error }); continue }
        const playersRaw = findNamedArray(item.payload, ['roster','rosters','players','athletes','studentAthletes'])
        const coachesRaw = findNamedArray(item.payload, ['coaches','coachingStaff','staff'])
        const roster = (playersRaw || []).map(player).filter((p: any) => p.displayName)
        const coaches = (coachesRaw || []).map(coach).filter((p: any) => p.displayName)
        const check = freshness(item.payload, roster, previousByTeam.get(item.team.id) || [], season)
        audits.push({ team_id: item.team.id, season_id: season.id, arbiter_team_id: Number(item.link.arbiter_team_id), status: check.status, verified: check.verified, reason: check.reason, incoming_count: roster.length, previous_count: (previousByTeam.get(item.team.id) || []).length, previous_overlap: Number(check.priorOverlap.toFixed(4)), evidence: { seasonMarkers: check.evidence }, checked_at: new Date().toISOString() })
        if (check.verified) verifiedPayloads.push({ team_id: item.team.id, season_id: season.id, source_url: null, roster_found: playersRaw !== null, coaches_found: coachesRaw !== null, roster, coaches })
      }
    }

    if (audits.length) {
      const { error: auditError } = await db.from('arbiter_roster_freshness').upsert(audits, { onConflict: 'team_id,season_id' })
      if (auditError) throw new Error(`Roster freshness audit write failed: ${auditError.message}`)
    }

    let imported = 0
    if (verifiedPayloads.length) {
      const importReq = new NextRequest('http://sectionx.internal/api/admin/arbiter-rosters', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teams: verifiedPayloads }) })
      const response = await importRosters(importReq)
      const result: any = await response.json()
      if (!response.ok || result?.success === false) throw new Error(result?.error || 'Verified roster import failed.')
      imported = Array.isArray(result?.results) ? result.results.length : verifiedPayloads.length
    }

    return NextResponse.json({ ok: true, season: season.name, previousSeason: previousSeason?.name || null, scanned: varsity.length, verified: verifiedPayloads.length, held: audits.filter(a => !a.verified).length, imported, failures, statuses: audits.reduce((acc: any, a: any) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc }, {}) })
  } catch (error) {
    console.error('Roster freshness automation failed:', error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
