import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function GET(req:NextRequest){
  const seasonId=req.nextUrl.searchParams.get('seasonId')
  if(!seasonId)return NextResponse.json({ok:false,error:'seasonId is required'},{status:400})
  try{
    const data:any=await getDb().prepare('SELECT id,season_id,mode,status,summary,created_at,finished_at,window_start,window_end FROM arbiter_sync_runs WHERE season_id=? ORDER BY created_at DESC LIMIT 1').bind(seasonId).first()
    if(!data)return NextResponse.json({ok:true,run:null})
    let summary:any={};try{summary=data.summary?JSON.parse(data.summary):{}}catch{summary={}}
    return NextResponse.json({ok:true,run:{id:data.id,seasonId:data.season_id,mode:data.mode,status:data.status,summary,createdAt:data.created_at,finishedAt:data.finished_at,window:{start:data.window_start,end:data.window_end},isRunning:data.status==='running'}})
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'Could not load sync status.'},{status:500})}
}
