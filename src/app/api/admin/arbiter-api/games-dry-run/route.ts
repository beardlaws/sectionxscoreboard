import { NextRequest, NextResponse } from 'next/server'
import { ArbiterApiError } from '@/lib/arbiter/client'
import { runScheduleAudit } from '@/lib/arbiter/schedule-intelligence'

export const dynamic = 'force-dynamic'

export async function GET(req:NextRequest){
  try{
    const yearRaw=req.nextUrl.searchParams.get('year')
    const audit=await runScheduleAudit({
      start:req.nextUrl.searchParams.get('start'),
      end:req.nextUrl.searchParams.get('end'),
      seasonId:req.nextUrl.searchParams.get('seasonId'),
      seasonType:req.nextUrl.searchParams.get('seasonType'),
      year:yearRaw&&Number.isFinite(Number(yearRaw))?Number(yearRaw):null,
    })
    return NextResponse.json({...audit,readiness:{normalizationFixed:true,seasonAware:true,comparisonGateBuilt:true,stableIdentityBuilt:true,externalAutoCreatePlanned:true,placeholderTimeProtected:true,eventSportQuarantine:true,partialSafeWrites:true,writerReady:audit.comparison.writerReady,nextGate:audit.comparison.writerReady?'Controlled writer is available but still requires explicit admin confirmation.':'Repair orphaned stable identity links before any controlled write.'},note:'Read-only season-aware Arbiter normalization and reconciliation audit. No game writes are performed.'})
  }catch(error){
    console.error('Arbiter game dry run error:',error)
    if(error instanceof ArbiterApiError)return NextResponse.json({ok:false,dryRun:true,writesPerformed:0,error:error.message,arbiterStatus:error.status,details:error.details},{status:502})
    return NextResponse.json({ok:false,dryRun:true,writesPerformed:0,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
