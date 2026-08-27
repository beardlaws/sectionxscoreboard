import { NextRequest, NextResponse } from 'next/server'
import { recordScheduleHealthCheck } from '@/lib/arbiter/health'

export const dynamic='force-dynamic'
export const maxDuration=300

export async function GET(req:NextRequest){
  const seasonId=req.nextUrl.searchParams.get('seasonId')
  if(!seasonId)return NextResponse.json({ok:false,error:'seasonId is required'},{status:400})
  try{
    const result=await recordScheduleHealthCheck(seasonId)
    return NextResponse.json({ok:true,...result})
  }catch(error){
    console.error('Arbiter health check error:',error)
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
