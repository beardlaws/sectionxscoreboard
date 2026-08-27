import { NextRequest, NextResponse } from 'next/server'
import { runScheduleAudit } from '@/lib/arbiter/schedule-intelligence'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PENDING_BUCKETS = new Set(['stable-id-update','exact-match','probable-match','new-game','external-create'])

function compactRow(row:any){
  return {
    bucket: row.bucket,
    arbiterGameId: row.uniqueGameId,
    date: row.date,
    time: row.time,
    sport: row.sport,
    gender: row.gender,
    level: row.level,
    status: row.status,
    title: row.title,
    location: row.location,
    home: row.home?.mapped || row.home?.arbiter || null,
    away: row.away?.mapped || row.away?.arbiter || null,
    existingGameId: row.existingGameId,
    existing: row.existing || null,
    driftReasons: row.driftReasons || [],
    mappingIssues: row.mappingIssues || [],
    warnings: row.warnings || [],
  }
}

function healthStatus(audit:any){
  if((audit.comparison.trueBlockers||0)>0 || !audit.comparison.writerReady) return 'blocked'
  if((audit.comparison.pendingChanges||0)>0 || (audit.comparison.quarantined||0)>0) return 'attention'
  return 'healthy'
}

export async function GET(req:NextRequest){
  const seasonId=req.nextUrl.searchParams.get('seasonId')
  if(!seasonId) return NextResponse.json({ok:false,error:'seasonId is required'},{status:400})

  const db=createAdminClient()
  try{
    const audit=await runScheduleAudit({seasonId})
    const changes=(audit.rows||[]).filter((r:any)=>PENDING_BUCKETS.has(r.bucket)).map(compactRow)
    const quarantines=(audit.rows||[]).filter((r:any)=>r.quarantined && r.bucket!=='other-season').map(compactRow)
    const status=healthStatus(audit)
    const summary={
      season:audit.season,
      window:audit.window,
      syncedStable:audit.comparison.counts?.['stable-id-match']||0,
      pendingChanges:audit.comparison.pendingChanges||0,
      quarantined:audit.comparison.quarantined||0,
      trueBlockers:audit.comparison.trueBlockers||0,
      writerReady:Boolean(audit.comparison.writerReady),
      counts:audit.comparison.counts||{},
      recordsReturned:audit.summary?.recordsReturned||0,
      uniqueGameIds:audit.summary?.uniqueGameIds||0,
      duplicateUniqueGameIds:audit.summary?.duplicateUniqueGameIds||0,
      checkedAt:new Date().toISOString(),
    }

    const {data:check,error}=await db.from('arbiter_health_checks').insert({
      season_id:audit.season.id,
      status,
      summary,
      changes,
      quarantines,
    }).select('id,created_at').single()
    if(error) throw new Error(`Could not record health check: ${error.message}`)

    return NextResponse.json({ok:true,checkId:check.id,createdAt:check.created_at,status,summary,changes,quarantines,audit})
  }catch(error){
    console.error('Arbiter health check error:',error)
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
