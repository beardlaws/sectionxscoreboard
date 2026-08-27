import { NextRequest,NextResponse } from 'next/server'
import { parseScoreText,previewScores,ScoreSource } from '@/lib/scores/intelligence'

export const dynamic='force-dynamic'
export const maxDuration=60

export async function POST(req:NextRequest){
  try{
    const body=await req.json().catch(()=>({}))
    const source=(body?.source||'manual-batch') as ScoreSource
    let records=Array.isArray(body?.records)?body.records:null
    let parseErrors:string[]=[]
    if(!records){const parsed=parseScoreText(String(body?.text||''));records=parsed.records;parseErrors=parsed.errors}
    const preview=await previewScores(records||[],source)
    return NextResponse.json({ok:true,readOnly:true,parseErrors,...preview})
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Score preview failed'},{status:500})}
}
