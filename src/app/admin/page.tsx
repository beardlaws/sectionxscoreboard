// src/app/admin/page.tsx
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { createAdminClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import Link from 'next/link'
import { sectionXDate, sectionXLongDate } from '@/lib/sectionx-time'
import { PlusCircle, Upload, CheckSquare, Image, Calendar, Users, BarChart2, ShieldCheck, Activity, ClipboardList, UserRoundCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const today=sectionXDate()
  const { env }=getCloudflareContext()
  const db=(env as any).DB
  if(!db) throw new Error('Cloudflare D1 binding DB is unavailable')

  const [pendingSubmissionsRow,pendingPhotosRow,pendingCorrectionsRow,activeSeason,todayGamesRow,totalGamesRow,totalSchoolsRow]=await Promise.all([
    db.prepare("SELECT count(*) AS n FROM submissions WHERE status='pending'").first(),
    db.prepare('SELECT count(*) AS n FROM photos WHERE approved=0').first(),
    db.prepare("SELECT count(*) AS n FROM correction_requests WHERE status IN ('open','pending')").first(),
    db.prepare('SELECT * FROM seasons WHERE is_active=1 LIMIT 1').first(),
    db.prepare('SELECT count(*) AS n FROM games WHERE game_date=?').bind(today).first(),
    db.prepare('SELECT count(*) AS n FROM games').first(),
    db.prepare('SELECT count(*) AS n FROM schools WHERE active=1').first(),
  ])
  const pendingSubmissions=Number((pendingSubmissionsRow as any)?.n||0),pendingPhotos=Number((pendingPhotosRow as any)?.n||0),pendingCorrections=Number((pendingCorrectionsRow as any)?.n||0),todayGames=Number((todayGamesRow as any)?.n||0),totalGames=Number((totalGamesRow as any)?.n||0),totalSchools=Number((totalSchoolsRow as any)?.n||0)

  // Schedule intelligence and contributor control remain on the legacy admin store
  // until those operational tables are migrated. Core scoreboard/admin queue counts above are D1.
  const admin=createAdminClient()
  const [{data:latestScheduleHealth},{data:latestScheduleRun},{count:contributorCount},{count:pendingContributors},{count:liveScorers}]=await Promise.all([
    (activeSeason as any)?.id?admin.from('arbiter_health_checks').select('status,summary,created_at').eq('season_id',(activeSeason as any).id).order('created_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    (activeSeason as any)?.id?admin.from('arbiter_sync_runs').select('status,summary,created_at,finished_at').eq('season_id',(activeSeason as any).id).in('status',['completed','completed-with-errors']).order('created_at',{ascending:false}).limit(1).maybeSingle():Promise.resolve({data:null}),
    admin.from('contributor_profiles').select('*',{count:'exact',head:true}).eq('status','approved'),
    admin.from('contributor_profiles').select('*',{count:'exact',head:true}).eq('status','pending'),
    admin.from('contributor_profiles').select('*',{count:'exact',head:true}).eq('status','approved').eq('can_live_score',true),
  ])

  const healthAt=new Date((latestScheduleHealth as any)?.created_at||0).getTime(),runAt=new Date((latestScheduleRun as any)?.finished_at||(latestScheduleRun as any)?.created_at||0).getTime(),runSupersedesHealth=Boolean(latestScheduleRun)&&runAt>=healthAt
  const schedulePending=runSupersedesHealth?0:Number((latestScheduleHealth as any)?.summary?.pendingChanges||0),scheduleBlockers=runSupersedesHealth?0:Number((latestScheduleHealth as any)?.summary?.trueBlockers||0)
  const scheduleDesc=latestScheduleHealth?scheduleBlockers>0?`${scheduleBlockers} blocker${scheduleBlockers===1?'':'s'} need attention`:schedulePending>0?`${schedulePending} Arbiter change${schedulePending===1?'':'s'} pending`:`Healthy · ${(latestScheduleHealth as any)?.summary?.syncedStable||0} stable`:'Run first full schedule health check'
  const contributorDesc=pendingContributors&&pendingContributors>0?`${pendingContributors} application${pendingContributors===1?'':'s'} need review`:`${contributorCount||0} active · ${liveScorers||0} live scorer${liveScorers===1?'':'s'}`
  const alerts=[scheduleBlockers>0?{label:`Schedule Intelligence has ${scheduleBlockers} global blocker${scheduleBlockers===1?'':'s'}`,href:'/admin/schedule-intelligence',color:'red'}:schedulePending>0?{label:`${schedulePending} Arbiter schedule change${schedulePending===1?'':'s'} waiting for review`,href:'/admin/schedule-intelligence',color:'amber'}:null,pendingContributors&&pendingContributors>0?{label:`${pendingContributors} contributor application${pendingContributors===1?'':'s'} awaiting approval`,href:'/admin/contributors',color:'amber'}:null,pendingSubmissions>0?{label:`${pendingSubmissions} pending score submission${pendingSubmissions!==1?'s':''}`,href:'/admin/submissions',color:'amber'}:null,pendingPhotos>0?{label:`${pendingPhotos} photo${pendingPhotos!==1?'s':''} awaiting approval`,href:'/admin/photos',color:'blue'}:null,pendingCorrections>0?{label:`${pendingCorrections} correction request${pendingCorrections!==1?'s':''}`,href:'/admin/corrections',color:'red'}:null].filter(Boolean)
  const quickActions=[{href:'/admin/fall-operations',icon:Activity,label:'Fall Operations',desc:'Schedules · scores · rosters · exceptions'},{href:'/admin/score-intelligence/today',icon:ClipboardList,label:"Today's Results",desc:'Finals · reported · missing results'},{href:'/admin/score-intelligence',icon:ShieldCheck,label:'Score Intelligence',desc:'Match and review backup score sources'},{href:'/admin/contributors',icon:UserRoundCheck,label:'Contributor Control Room',desc:contributorDesc},{href:'/admin/schedule-intelligence',icon:ShieldCheck,label:'Schedule Intelligence',desc:scheduleDesc},{href:'/admin/scores/entry',icon:PlusCircle,label:'Enter Score',desc:'Add a single game result'},{href:'/admin/scores/manage',icon:BarChart2,label:'Manage Games',desc:'Edit or delete games'},{href:'/admin/import',icon:Upload,label:'Import Center',desc:'Paste or upload scores/schedules'},{href:'/admin/submissions',icon:CheckSquare,label:'Review Submissions',desc:`${pendingSubmissions} pending`},{href:'/admin/photos',icon:Image,label:'Photo Queue',desc:`${pendingPhotos} pending`},{href:'/admin/seasons',icon:Calendar,label:'Seasons',desc:'Manage active season'},{href:'/admin/teams',icon:Users,label:'Teams',desc:'Activate/deactivate teams'}]
  return <AdminLayout><div className="p-4 max-w-4xl"><div className="mb-5"><h1 className="text-2xl font-bold text-white" style={{fontFamily:'var(--font-display)'}}>Admin Dashboard</h1><p className="text-sm mt-0.5" style={{color:'var(--text-secondary)'}}>{(activeSeason as any)?.name||'No active season'} · {sectionXLongDate()}</p></div>{alerts.length>0&&<div className="space-y-2 mb-5">{alerts.map((alert:any,i)=>alert&&<Link key={i} href={alert.href} className="flex items-center justify-between p-3 rounded-lg text-sm" style={{background:alert.color==='amber'?'rgba(251,191,36,0.1)':alert.color==='red'?'rgba(239,68,68,0.1)':'rgba(59,130,246,0.1)',border:`1px solid ${alert.color==='amber'?'rgba(251,191,36,0.3)':alert.color==='red'?'rgba(239,68,68,0.3)':'rgba(59,130,246,0.3)'}`,color:alert.color==='amber'?'#fbbf24':alert.color==='red'?'#f87171':'#93c5fd'}}><span>⚠️ {alert.label}</span><span className="text-xs opacity-70">Review →</span></Link>)}</div>}<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">{[{label:"Today's Games",value:todayGames},{label:'Total Games',value:totalGames},{label:'Schools',value:totalSchools},{label:'Season',value:(activeSeason as any)?.season_type||'—'}].map(stat=><div key={stat.label} className="card p-4 text-center"><div className="text-2xl font-bold text-white" style={{fontFamily:'var(--font-scoreboard)'}}>{stat.value}</div><div className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{stat.label}</div></div>)}</div><h2 className="section-label mb-3">Quick Actions</h2><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{quickActions.map(action=>{const Icon=action.icon;return <Link key={action.href} href={action.href} className="admin-action-btn"><Icon size={22} style={{color:'var(--accent-bright)'}}/><div><div className="font-semibold text-sm" style={{fontFamily:'var(--font-display)'}}>{action.label}</div><div className="text-xs" style={{color:'var(--text-muted)'}}>{action.desc}</div></div></Link>})}</div></div></AdminLayout>
}
