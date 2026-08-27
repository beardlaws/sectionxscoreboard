import { NextRequest, NextResponse } from 'next/server'
import { runScheduleAudit } from '@/lib/arbiter/schedule-intelligence'

export const dynamic='force-dynamic'
export const maxDuration=300

const ACTIONABLE=new Set(['stable-id-update','exact-match','probable-match','new-game','external-create'])
const UNLINKED=new Set(['exact-match','probable-match'])

function countBy<T>(values:T[]){
  const m=new Map<string,number>()
  for(const value of values){
    const key=String(value??'Unknown')
    m.set(key,(m.get(key)||0)+1)
  }
  return [...m.entries()].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label))
}

function rowView(row:any){
  return {
    arbiterGameId:row.uniqueGameId,
    bucket:row.bucket,
    sport:row.sport,
    gender:row.gender,
    date:row.date,
    time:row.time,
    title:row.title,
    status:row.status,
    location:row.location,
    home:row.home?.mapped||row.home?.arbiter||null,
    away:row.away?.mapped||row.away?.arbiter||null,
    existingGameId:row.existingGameId||null,
    existing:row.existing||null,
    driftReasons:row.driftReasons||[],
    mappingIssues:row.mappingIssues||[],
    warnings:row.warnings||[],
  }
}

export async function GET(req:NextRequest){
  const seasonId=req.nextUrl.searchParams.get('seasonId')
  if(!seasonId)return NextResponse.json({ok:false,error:'seasonId is required'},{status:400})
  try{
    const audit=await runScheduleAudit({seasonId})
    const rows=audit.rows||[]
    const actionable=rows.filter((r:any)=>ACTIONABLE.has(r.bucket))
    const unlinked=rows.filter((r:any)=>UNLINKED.has(r.bucket))
    const newGames=rows.filter((r:any)=>r.bucket==='new-game')
    const external=rows.filter((r:any)=>r.bucket==='external-create')
    const updates=rows.filter((r:any)=>r.bucket==='stable-id-update'||r.bucket==='probable-match')
    const quarantines=rows.filter((r:any)=>r.quarantined&&r.bucket!=='other-season')
    const byBucket=countBy(actionable.map((r:any)=>r.bucket))
    const bySport=countBy(actionable.map((r:any)=>r.sport))
    const quarantineByBucket=countBy(quarantines.map((r:any)=>r.bucket))
    const quarantineBySport=countBy(quarantines.map((r:any)=>r.sport))
    const adoption={
      existingToLink:unlinked.length,
      stableUpdates:rows.filter((r:any)=>r.bucket==='stable-id-update').length,
      newGames:newGames.length,
      externalGames:external.length,
      quarantined:quarantines.length,
      blockers:audit.comparison.trueBlockers||0,
      totalActionable:actionable.length,
      writerReady:Boolean(audit.comparison.writerReady),
      alreadyStable:audit.comparison.counts?.['stable-id-match']||0,
    }
    return NextResponse.json({
      ok:true,
      season:audit.season,
      window:audit.window,
      adoption,
      breakdowns:{actionableBuckets:byBucket,sports:bySport,quarantineBuckets:quarantineByBucket,quarantineSports:quarantineBySport},
      groups:{
        unlinked:unlinked.map(rowView),
        updates:updates.map(rowView),
        newGames:newGames.map(rowView),
        external:external.map(rowView),
        quarantines:quarantines.map(rowView),
      },
    })
  }catch(error){
    console.error('Arbiter preflight error:',error)
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
