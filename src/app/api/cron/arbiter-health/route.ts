import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { recordScheduleHealthCheck } from '@/lib/arbiter/health'
import { runLiveOperationsCheck } from '@/lib/arbiter/live-operations'

export const dynamic='force-dynamic'
export const maxDuration=300

export async function GET(req:NextRequest){
  const {env}=getCloudflareContext()
  const secret=String((env as any).CRON_SECRET||(env as any).SECTIONX_AUTOMATION_KEY||process.env.CRON_SECRET||process.env.SECTIONX_AUTOMATION_KEY||'')
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||req.headers.get('x-sectionx-automation-key')||''
  if(!secret||token!==secret)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const db=(env as any).DB
  if(!db)return NextResponse.json({ok:false,error:'Cloudflare D1 binding DB is unavailable'},{status:500})
  try{
    const query=await db.prepare(`SELECT id,name,year,season_type,is_active FROM seasons WHERE season_type IN ('Fall','Winter','Spring') ORDER BY year DESC`).all()
    const seasons=(query.results||[]).map((s:any)=>({...s,is_active:Boolean(s.is_active)}))
    const active=seasons.find((s:any)=>s.is_active)||seasons[0]||null
    if(!active)throw new Error('No season found for Arbiter health monitoring.')
    const y=Number(active.year),schoolYearStart=String(active.season_type)==='Spring'?y-1:y
    const cycle=seasons.filter((s:any)=>(s.season_type==='Fall'&&Number(s.year)===schoolYearStart)||(s.season_type==='Winter'&&Number(s.year)===schoolYearStart)||(s.season_type==='Spring'&&Number(s.year)===schoolYearStart+1))
    const results=[]
    for(const season of cycle){
      try{const check=await recordScheduleHealthCheck(season.id);results.push({season:season.name,seasonId:season.id,status:check.status,summary:check.summary,checkId:check.checkId})}
      catch(error){results.push({season:season.name,seasonId:season.id,status:'error',error:error instanceof Error?error.message:String(error)})}
    }
    let liveOperations:any=null
    try{
      const live=await runLiveOperationsCheck(active.id)
      liveOperations={season:live.season,checkedAt:live.checkedAt,schedule:live.schedule,scores:{safeToApply:live.scores.safeToApply,conflicts:live.scores.conflicts,counts:live.scores.counts},rosters:{varsityTeams:live.rosters.varsityTeams,loaded:live.rosters.loaded,missing:live.rosters.missing},exceptions:live.exceptions.length}
    }catch(error){liveOperations={error:error instanceof Error?error.message:String(error)}}
    const ok=results.every((r:any)=>r.status!=='error'&&r.status!=='blocked')&&!liveOperations?.error
    return NextResponse.json({ok,readOnly:true,checkedAt:new Date().toISOString(),results,liveOperations},{status:ok?200:207})
  }catch(error){
    console.error('Arbiter cron health error:',error)
    return NextResponse.json({ok:false,readOnly:true,error:error instanceof Error?error.message:'Unknown error'},{status:500})
  }
}
