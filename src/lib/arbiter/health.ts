import { getCloudflareContext } from '@opennextjs/cloudflare'
import { runScheduleAudit } from '@/lib/arbiter/schedule-intelligence'

const PENDING_BUCKETS=new Set(['stable-id-update','exact-match','probable-match','new-game','external-create'])

function compactRow(row:any){
  return {
    bucket:row.bucket,
    arbiterGameId:row.uniqueGameId,
    date:row.date,time:row.time,sport:row.sport,gender:row.gender,level:row.level,status:row.status,title:row.title,location:row.location,
    home:row.home?.mapped||row.home?.arbiter||null,
    away:row.away?.mapped||row.away?.arbiter||null,
    existingGameId:row.existingGameId,
    existing:row.existing||null,
    driftReasons:row.driftReasons||[],mappingIssues:row.mappingIssues||[],warnings:row.warnings||[],
  }
}

function healthStatus(audit:any){
  if((audit.comparison.trueBlockers||0)>0||!audit.comparison.writerReady)return'blocked'
  if((audit.comparison.pendingChanges||0)>0)return'attention'
  return'healthy'
}

export async function recordScheduleHealthCheck(seasonId:string){
  const audit=await runScheduleAudit({seasonId})
  const changes=(audit.rows||[]).filter((r:any)=>PENDING_BUCKETS.has(r.bucket)).map(compactRow)
  const quarantines=(audit.rows||[]).filter((r:any)=>r.quarantined&&r.bucket!=='other-season').map(compactRow)
  const status=healthStatus(audit)
  const summary={season:audit.season,window:audit.window,syncedStable:audit.comparison.counts?.['stable-id-match']||0,pendingChanges:audit.comparison.pendingChanges||0,quarantined:audit.comparison.quarantined||0,trueBlockers:audit.comparison.trueBlockers||0,writerReady:Boolean(audit.comparison.writerReady),counts:audit.comparison.counts||{},recordsReturned:audit.summary?.recordsReturned||0,uniqueGameIds:audit.summary?.uniqueGameIds||0,duplicateUniqueGameIds:audit.summary?.duplicateUniqueGameIds||0,checkedAt:new Date().toISOString()}

  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

  const id=crypto.randomUUID()
  const createdAt=new Date().toISOString()
  await db.prepare(`INSERT INTO arbiter_health_checks (id,season_id,status,summary,changes,quarantines,created_at) VALUES (?,?,?,?,?,?,?)`)
    .bind(id,audit.season.id,status,JSON.stringify(summary),JSON.stringify(changes),JSON.stringify(quarantines),createdAt)
    .run()

  return{checkId:id,createdAt,status,summary,changes,quarantines,audit}
}
