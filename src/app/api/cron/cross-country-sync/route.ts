import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { arbiterApi } from '@/lib/arbiter/client'
import { SECTION_X_SCHOOL_IDS } from '@/lib/arbiter/schedule-intelligence'

export const dynamic='force-dynamic'
export const maxDuration=300
const arr=(v:any)=>Array.isArray(v)?v:v==null?[]:[v]
const clean=(v:any)=>String(v||'').trim()
const norm=(v:any)=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()
const day=(v:any)=>String(v||'').slice(0,10)
const time=(v:any)=>String(v||'').slice(11,16)
const slug=(v:any)=>norm(v).replace(/\s+/g,'-').slice(0,120)
const isXC=(g:any)=>norm(g?.sportName).includes('cross country')
const isVarsityXC=(g:any)=>isXC(g)&&norm(g?.levelName)==='varsity'&&norm(g?.gameTypeName)!=='practice'
const gender=(g:any)=>norm(g?.gender).includes('girl')?'Girls':norm(g?.gender).includes('boy')?'Boys':null
const decode=(v:any)=>clean(v).replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&#39;|&apos;/gi,"'")
const title=(g:any)=>{const raw=decode(g?.title)||decode(g?.siteName)||'Cross Country Meet';const base=raw.replace(/\b(boys|girls|varsity|cross country|xc)\b/ig,' ').replace(/\s+/g,' ').trim();return base?`${base} Cross Country Meet`:'Cross Country Meet'}
const pickTitle=(rows:any[])=>[...rows.map(title).filter(Boolean)].sort((a,b)=>{const rank=(v:string)=>/championship/i.test(v)?5:/interdivision/i.test(v)?4:/invite|invitational|festival/i.test(v)?3:/league meet/i.test(v)?2:1;return rank(b)-rank(a)||a.length-b.length})[0]||'Cross Country Meet'
const meetTypeFor=(name:string)=>/championship/i.test(name)?'Championship':/invite|invitational|festival|herrmann|spartan/i.test(name)?'Invitational':/scrimmage/i.test(name)?'Scrimmage':'League'
const statusFor=(rows:any[])=>rows.some(g=>['cancelled','canceled'].includes(norm(g?.status)))?'Canceled':rows.some(g=>norm(g?.status).includes('live'))?'Live':'Scheduled'
const first=async(db:any,sql:string,...binds:any[])=>await db.prepare(sql).bind(...binds).first()

export async function GET(req:NextRequest){
  const {env}=getCloudflareContext();const db=(env as any).DB
  if(!db)return NextResponse.json({ok:false,error:'Cloudflare D1 binding DB is unavailable'},{status:500})
  const repairToken=req.headers.get('x-sectionx-automation-key')||''
  const cronSecret=process.env.CRON_SECRET
  const repairSecret=(env as any).SECTIONX_AUTOMATION_KEY||process.env.SECTIONX_AUTOMATION_KEY||''
  const authorized=Boolean((repairToken&&repairSecret&&repairToken===repairSecret)||(cronSecret&&req.headers.get('authorization')===`Bearer ${cronSecret}`))
  if(!authorized)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})

  const one=req.nextUrl.searchParams.get('date'),today=new Date().toISOString().slice(0,10)
  const rangeStart=req.nextUrl.searchParams.get('start')||one||today
  const rangeEnd=req.nextUrl.searchParams.get('end')||one||new Date(Date.now()+30*86400000).toISOString().slice(0,10)
  const raw=arr(await arbiterApi.games({SchoolIds:Array.from(SECTION_X_SCHOOL_IDS),DateFilter:'Range',GameStartDate:`${rangeStart}T00:00:00.000Z`,GameEndDate:`${rangeEnd}T23:59:59.999Z`,IncludeDeletedGames:false,IncludePendingInformation:false}))
  const xc=raw.filter(isVarsityXC),groups=new Map<string,any[]>()
  for(const g of xc){const k=[day(g.fromDate),time(g.fromDate),norm(g.subSiteName||g.siteName)].join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k)!.push(g)}

  const season=await first(db,`SELECT id,name FROM seasons WHERE is_active=1 ORDER BY year DESC LIMIT 1`)
  if(!season)return NextResponse.json({ok:false,error:'No active season'},{status:400})
  const sports=(await db.prepare(`SELECT id,slug,gender FROM sports WHERE slug IN ('boys-cross-country','girls-cross-country')`).all()).results||[]
  const links=(await db.prepare(`SELECT team_id,arbiter_team_id FROM arbiter_team_links`).all()).results||[]
  const linkByArb=new Map(links.map((x:any)=>[Number(x.arbiter_team_id),x.team_id])),meets:any[]=[]

  for(const [key,rows] of groups){
    const lead=rows[0],meetName=pickTitle(rows),location=decode(lead?.subSiteName||lead?.siteName)||null,meetTime=time(lead?.fromDate)||null,meetDate=day(lead?.fromDate)||rangeStart,sourceKey='arbiter-xc:'+slug(key),now=new Date().toISOString()
    let meet:any=await first(db,`SELECT * FROM cross_country_meets WHERE source_event_key=? LIMIT 1`,sourceKey)
    if(!meet){
      meet=await first(db,`SELECT * FROM cross_country_meets WHERE season_id=? AND meet_date=? AND ((meet_time IS NULL AND ? IS NULL) OR meet_time=?) AND COALESCE(location,'')=COALESCE(?,'') ORDER BY created_at LIMIT 1`,season.id,meetDate,meetTime,meetTime,location)
      if(meet&&meet.status!=='Final')await db.prepare(`UPDATE cross_country_meets SET source_event_key=?,updated_at=? WHERE id=?`).bind(sourceKey,now,meet.id).run()
    }
    const payload=JSON.stringify(rows)
    if(!meet){
      const id=crypto.randomUUID();await db.prepare(`INSERT INTO cross_country_meets (id,season_id,meet_name,meet_date,meet_time,location,meet_type,status,source,source_event_key,source_payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,season.id,meetName,meetDate,meetTime,location,meetTypeFor(meetName),statusFor(rows),'arbiter',sourceKey,payload,now,now).run();meet=await first(db,`SELECT * FROM cross_country_meets WHERE id=?`,id)
    }else if(meet.status!=='Final'){
      await db.prepare(`UPDATE cross_country_meets SET meet_name=?,meet_time=?,location=?,meet_type=?,status=?,source_event_key=?,source_payload=?,updated_at=? WHERE id=?`).bind(meetName,meetTime,location,meetTypeFor(meetName),statusFor(rows),sourceKey,payload,now,meet.id).run();meet={...meet,meet_name:meetName,meet_time:meetTime,location,status:statusFor(rows)}
    }

    const participants:any[]=[]
    for(const g of rows){const sp=sports.find((s:any)=>s.gender===gender(g));if(!sp)continue;for(const tm of arr(g?.teams)){const teamId=linkByArb.get(Number(tm?.teamId));if(teamId)participants.push({sport_id:sp.id,team_id:teamId,is_section_x:1})}}
    const dedup=[...new Map(participants.map((p:any)=>[`${p.sport_id}:${p.team_id}`,p])).values()]
    if(meet&&meet.status!=='Final'){
      await db.prepare(`DELETE FROM cross_country_team_results WHERE meet_id=?`).bind(meet.id).run()
      for(const p of dedup)await db.prepare(`INSERT INTO cross_country_team_results (id,meet_id,sport_id,team_id,team_score,finish_place,is_section_x,created_at) VALUES (?,?,?,?,NULL,NULL,?,?)`).bind(crypto.randomUUID(),meet.id,p.sport_id,p.team_id,p.is_section_x,now).run()
    }
    meets.push({id:meet?.id,name:meetName,date:meetDate,time:meetTime,location,participants:dedup.length})
  }
  return NextResponse.json({ok:true,start:rangeStart,end:rangeEnd,records:xc.length,meets})
}
