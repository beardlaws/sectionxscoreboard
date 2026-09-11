import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'
import { arbiterApi } from '@/lib/arbiter/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const REPAIR_KEY = 'sx-roster-repair-20260828-7f3c91'
const clean = (v: unknown) => String(v ?? '').trim()
const norm = (v: unknown) => clean(v).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
const arr = (v: any): any[] => Array.isArray(v) ? v : v == null ? [] : [v]
function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

function varsityLevel(v: unknown) { const x = norm(v); return x.includes('varsity') && !x.includes('junior') }
function normalizeSport(v: unknown) { return norm(v).replace(/\b(girls|boys|mens|womens|male|female)\b/g, '').replace(/association football/g, 'soccer').replace(/crosscountry/g, 'cross country').replace(/volley ball/g, 'volleyball').replace(/\s+/g, ' ').trim() }
function sportEquivalent(a: unknown, b: unknown) { const x = normalizeSport(a), y = normalizeSport(b); return Boolean(x && y && (x === y || x.includes(y) || y.includes(x))) }
function genderCompatible(candidate: unknown, target: unknown, teamName: unknown = '') {
  const cg = norm(candidate), tg = norm(target), tn = norm(teamName)
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
function seasonWindow(season: any) { const type = norm(season.season_type), year = Number(season.year); if (type === 'winter') return { start: `${year}-11-01T00:00:00.000Z`, end: `${year + 1}-03-31T23:59:59.999Z` }; if (type === 'spring') return { start: `${year}-03-01T00:00:00.000Z`, end: `${year}-06-30T23:59:59.999Z` }; return { start: `${year}-08-01T00:00:00.000Z`, end: `${year}-11-30T23:59:59.999Z` } }
function scheduleObservations(raw: any) {
  const observations: any[] = []
  for (const game of arr(raw)) { const sportName = clean(game?.sportName), gender = clean(game?.gender), level = clean(game?.levelName); if (!varsityLevel(level)) continue; for (const team of arr(game?.teams)) { const teamId = Number(team?.teamId), schoolId = Number(team?.schoolId); if (!Number.isFinite(teamId) || !Number.isFinite(schoolId) || !teamId || !schoolId) continue; observations.push({ teamId, schoolId, teamName: clean(team?.teamName), schoolName: clean(team?.schoolName), sportName, gender, level }) } }
  return observations
}
function varsitySchoolIds(varsity: any[], schoolById: Map<any, any>) { return varsity.map((team: any) => Number((schoolById.get(team.school_id) as any)?.arbiter_entity_id)).filter((id: number) => Number.isFinite(id) && id > 0) }

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== REPAIR_KEY) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  try {
    const db=getDb()
    const season:any=await db.prepare('SELECT id,name,season_type,year,is_active FROM seasons WHERE is_active=1 LIMIT 1').first()
    if(!season)throw new Error('No active season found.')
    const [teamSeasonsResult,teamsResult,schoolsResult,sportsResult,linksResult]=await Promise.all([
      db.prepare('SELECT team_id FROM team_seasons WHERE season_id=? AND active_for_season=1').bind(season.id).all(),
      db.prepare('SELECT id,school_id,sport_id,team_name,level,active FROM teams WHERE active=1').all(),
      db.prepare('SELECT id,school_name,arbiter_entity_id FROM schools WHERE active=1 AND arbiter_entity_id IS NOT NULL').all(),
      db.prepare('SELECT id,sport_name,gender,season_type,slug FROM sports').all(),
      db.prepare('SELECT team_id,arbiter_team_id,arbiter_school_id,observed_count FROM arbiter_team_links').all(),
    ])
    const teamSeasons:any[]=teamSeasonsResult.results||[],teams:any[]=teamsResult.results||[],schools:any[]=schoolsResult.results||[],sports:any[]=sportsResult.results||[],existingLinks:any[]=linksResult.results||[]
    const activeTeamIds=new Set(teamSeasons.map((x:any)=>x.team_id)),varsity=teams.filter((t:any)=>activeTeamIds.has(t.id)&&varsityLevel(t.level))
    const schoolById=new Map(schools.map((s:any)=>[s.id,s])),sportById=new Map(sports.map((s:any)=>[s.id,s])),existingByTeam=new Map(existingLinks.map((l:any)=>[l.team_id,l]))
    const arbiterSchoolIds=[...new Set(varsitySchoolIds(varsity,schoolById))]
    const window=seasonWindow(season)
    const gameRaw=arbiterSchoolIds.length?await arbiterApi.games({SchoolIds:arbiterSchoolIds,DateFilter:'Range',GameStartDate:window.start,GameEndDate:window.end,IncludeDeletedGames:false,IncludePendingInformation:false}):[]
    const observations=scheduleObservations(gameRaw),updates:any[]=[],held:any[]=[]
    for(const team of varsity){
      const school:any=schoolById.get(team.school_id),sport:any=sportById.get(team.sport_id),schoolId=Number(school?.arbiter_entity_id)
      if(!schoolId||!sport){held.push({teamId:team.id,teamName:team.team_name,reason:'missing-school-or-sport-mapping'});continue}
      const compatible=observations.filter(o=>o.schoolId===schoolId&&sportEquivalent(o.sportName||o.teamName,sport.sport_name)&&genderCompatible(o.gender,sport.gender,o.teamName)&&varsityLevel(o.level))
      const byId=new Map<number,any>();for(const o of compatible)if(!byId.has(o.teamId))byId.set(o.teamId,o)
      if(byId.size!==1){held.push({teamId:team.id,teamName:team.team_name,school:school.school_name,sport:sport.sport_name,reason:byId.size===0?'no-current-season-schedule-team-id':'multiple-current-season-schedule-team-ids',observedTeamIds:[...byId.keys()]});continue}
      const observation=[...byId.values()][0],previous:any=existingByTeam.get(team.id),now=new Date().toISOString()
      updates.push({team_id:team.id,arbiter_team_id:observation.teamId,arbiter_school_id:schoolId,source:'current-season-schedule-observation',confidence:'stable',observed_count:Number(previous?.observed_count||0)+compatible.length,last_seen_at:now,updated_at:now})
    }
    let written=0;const writeFailures:any[]=[]
    for(const row of updates){
      try{
        await db.prepare(`INSERT INTO arbiter_team_links (team_id,arbiter_team_id,arbiter_school_id,source,confidence,observed_count,last_seen_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(team_id) DO UPDATE SET arbiter_team_id=excluded.arbiter_team_id,arbiter_school_id=excluded.arbiter_school_id,source=excluded.source,confidence=excluded.confidence,observed_count=excluded.observed_count,last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at`)
          .bind(row.team_id,row.arbiter_team_id,row.arbiter_school_id,row.source,row.confidence,row.observed_count,row.last_seen_at,row.updated_at).run();written++
      }catch(error:any){writeFailures.push({teamId:row.team_id,arbiterTeamId:row.arbiter_team_id,error:error?.message||String(error)})}
    }
    return NextResponse.json({ok:writeFailures.length===0,season:season.name,scanned:varsity.length,scheduleObservations:observations.length,uniqueArbiterSchoolIds:arbiterSchoolIds.length,matched:updates.length,written,held:held.length,heldDetails:held.slice(0,100),writeFailures,sampleUpdates:updates.slice(0,20).map(x=>({teamId:x.team_id,arbiterTeamId:x.arbiter_team_id,arbiterSchoolId:x.arbiter_school_id}))})
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:String(error)},{status:500})}
}
