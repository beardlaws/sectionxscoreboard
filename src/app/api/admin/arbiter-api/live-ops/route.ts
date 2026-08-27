import { NextRequest, NextResponse } from 'next/server'
import { runLiveOperationsCheck } from '@/lib/arbiter/live-operations'

export const dynamic='force-dynamic'
export const maxDuration=300

export async function GET(req:NextRequest){
  try{
    const seasonId=req.nextUrl.searchParams.get('seasonId')
    const result=await runLiveOperationsCheck(seasonId)
    return NextResponse.json(result)
  }catch(error){
    console.error('Arbiter live operations check failed:',error)
    return NextResponse.json({ok:false,readOnly:true,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
