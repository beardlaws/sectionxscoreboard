import { NextRequest,NextResponse } from 'next/server'
import { applyPreviewRows,ScoreSource } from '@/lib/scores/intelligence'

export const dynamic='force-dynamic'
export const maxDuration=60
const CONFIRM='APPLY_SCORE_INTELLIGENCE_RESULTS'

export async function POST(req:NextRequest){
  try{
    const body=await req.json().catch(()=>({}))
    if(body?.confirm!==CONFIRM)return NextResponse.json({ok:false,error:'Explicit confirmation required.',requiredConfirmation:CONFIRM},{status:400})
    const source=(body?.source||'manual-batch') as ScoreSource
    const rows=Array.isArray(body?.rows)?body.rows:[]
    const result=await applyPreviewRows(rows,source)
    return NextResponse.json({ok:result.failed===0,controlledWrite:true,source,...result},{status:result.failed?207:200})
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Score apply failed'},{status:500})}
}
