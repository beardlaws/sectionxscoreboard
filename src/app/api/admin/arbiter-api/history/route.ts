import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}
function json(v:any,fallback:any){if(v==null)return fallback;try{return typeof v==='string'?JSON.parse(v):v}catch{return fallback}}

export async function GET(req:NextRequest){
  const seasonId=req.nextUrl.searchParams.get('seasonId')
  if(!seasonId) return NextResponse.json({ok:false,error:'seasonId is required'},{status:400})
  const limit=Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')||10),1),50)
  try{
    const db=getDb()
    const [checksResult,runsResult]=await Promise.all([
      db.prepare('SELECT id,status,summary,changes,quarantines,created_at FROM arbiter_health_checks WHERE season_id=? ORDER BY created_at DESC LIMIT ?').bind(seasonId,limit).all(),
      db.prepare('SELECT id,status,summary,created_at,finished_at FROM arbiter_sync_runs WHERE season_id=? ORDER BY created_at DESC LIMIT ?').bind(seasonId,limit).all(),
    ])
    const checks=(checksResult.results||[]).map((x:any)=>({...x,summary:json(x.summary,{}),changes:json(x.changes,[]),quarantines:json(x.quarantines,[])}))
    const runs=(runsResult.results||[]).map((x:any)=>({...x,summary:json(x.summary,{})}))
    return NextResponse.json({ok:true,checks,runs})
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
