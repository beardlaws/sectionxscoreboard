import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { GET as runRosterSync } from '@/app/api/cron/arbiter-rosters-v2/route'

export const dynamic='force-dynamic'
const STALE_MINUTES=12,HARD_STALE_MINUTES=30,REPAIR_KEY='sx-roster-repair-20260828-7f3c91'
const nowIso=()=>new Date().toISOString()
function parseSummary(v:any){if(!v)return{};if(typeof v==='object')return v;try{return JSON.parse(v)}catch{return{}}}
const heartbeatMs=(r:any)=>new Date(parseSummary(r?.summary)?.progress?.heartbeatAt||r?.started_at||0).getTime()
const runAgeMs=(r:any)=>Date.now()-new Date(r?.started_at||0).getTime()
const isStale=(r:any)=>{const h=heartbeatMs(r);return !Number.isFinite(h)||h<=0||runAgeMs(r)>HARD_STALE_MINUTES*60000||Date.now()-h>STALE_MINUTES*60000}
function db(){const{env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}

export async function GET(){try{const result=await db().prepare('SELECT id,season_id,trigger_source,status,summary,started_at,finished_at FROM arbiter_roster_automation_runs ORDER BY started_at DESC LIMIT 5').all();const runs=(result.results||[]).map((r:any)=>({...r,summary:parseSummary(r.summary)}));return NextResponse.json({ok:true,runs})}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'D1 error'},{status:500})}}

export async function POST(){
 try{
  const d=db(),running:any=await d.prepare("SELECT id,status,summary,started_at FROM arbiter_roster_automation_runs WHERE status='running' ORDER BY started_at DESC LIMIT 1").first()
  if(running&&!isStale(running)){const summary=parseSummary(running.summary);return NextResponse.json({ok:false,error:'Roster automation is already running.',runId:running.id,progress:summary.progress||{}},{status:409})}
  if(running&&isStale(running)){const old=parseSummary(running.summary),summary={...old,error:'Previous roster run exceeded the heartbeat window and was automatically retired.',stale:true,staleDetectedAt:nowIso(),progress:{...(old.progress||{}),phase:'stale',heartbeatAt:old.progress?.heartbeatAt||running.started_at}};await d.prepare("UPDATE arbiter_roster_automation_runs SET status='failed',summary=?,finished_at=? WHERE id=? AND status='running'").bind(JSON.stringify(summary),nowIso(),running.id).run()}
  const req=new NextRequest('https://sectionxscoreboard.com/api/cron/arbiter-rosters-v2',{method:'GET',headers:{'x-sectionx-internal-repair':REPAIR_KEY}})
  const response=await runRosterSync(req),body:any=await response.json().catch(()=>({}))
  if(!response.ok)return NextResponse.json({ok:false,error:body.error||'Could not trigger roster automation.',details:body},{status:response.status})
  return NextResponse.json({ok:true,queued:true,requestedAt:nowIso(),retiredStaleRun:running?.id||null,...body})
 }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:'Roster automation failed'},{status:500})}
}
