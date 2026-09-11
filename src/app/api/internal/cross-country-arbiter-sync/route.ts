import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { arbiterApi } from '@/lib/arbiter/client'
import { SECTION_X_SCHOOL_IDS } from '@/lib/arbiter/schedule-intelligence'

export const dynamic='force-dynamic'
export const maxDuration=120
const arr=(v:any)=>Array.isArray(v)?v:v==null?[]:[v]
const clean=(v:any)=>String(v||'').trim()
const norm=(v:any)=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()
const day=(v:any)=>String(v||'').slice(0,10)
const time=(v:any)=>String(v||'').slice(11,16)
const slug=(v:any)=>norm(v).replace(/\s+/g,'-').slice(0,120)
const isXC=(g:any)=>norm(g?.sportName).includes('cross country')
const gender=(g:any)=>norm(g?.gender).includes('girl')?'Girls':norm(g?.gender).includes('boy')?'Boys':null
const baseTitle=(g:any)=>{const raw=clean(g?.title)||clean(g?.siteName)||'Cross Country Meet';return raw.replace(/\b(boys|girls|varsity|cross country|xc)\b/ig,' ').replace(/\s+/g,' ').trim()||'Cross Country Meet'}
const statusFor=(rows:any[])=>rows.some(g=>['cancelled','canceled'].includes(norm(g?.status)))?'Canceled':rows.some(g=>norm(g?.status).includes('live'))?'Live':'Scheduled'

export async function GET(req:NextRequest){
  const {env}=getCloudflareContext();const db=(env as any).DB
  if(!db)return NextResponse.json({ok:false,error:'Cloudflare D1 binding DB is unavailable'},{status:500})
  const supplied=req.headers.get('x-sectionx-automation-key')||req.nextUrl.searchParams.get('key')||''
  const expected=(env as any).SECTIONX_AUTOMATION_KEY||process.env.SECTIONX_AUTOMATION_KEY||''
  if(!expected||supplied!==expected)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})

  const target=req.nextUrl.searchParams.get('date')||new Date().toISOString().slice(0,10)
  const apply=req.nextUrl.searchParams.get('apply')==='1'
  const raw=arr(await arbiterApi.games({SchoolIds:Array.from(SECTION_X_SCHOOL_IDS),DateFilter:'Range',GameStartDate:`${target}T00:00:00.000Z`,GameEndDate:`${target}T23:59:59.999Z`,IncludeDeletedGames:false,IncludePendingInformation:false}))
  const xc=raw.filter(isXC),groups=new Map<string,any[]>()
  for(const g of xc){const k=[day(g.fromDate),time(g.fromDate),norm(g.siteName||g.subSiteName),norm(baseTitle(g))].join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k)!.push(g)}

  const season=await db.prepare(`SELECT id,name FROM seasons WHERE is_active=1 ORDER BY year DESC LIMIT 1`).first()
  const sports=(await db.prepare(`SELECT id,slug,gender FROM sports WHERE slug IN ('boys-cross-country','girls-cross-country')`).all()).results||[]
  const links=(await db.prepare(`SELECT team_id,arbiter_team_id FROM arbiter_team_links`).all()).results||[]
  const linkByArb=new Map(links.map((x:any)=>[Number(x.arbiter_team_id),x.team_id]))
  const summary:any[]=[]

  for(const [key,rows] of groups){
    const firstRow=rows[0],meetName=baseTitle(firstRow),location=clean(firstRow?.subSiteName||firstRow?.siteName)||null,meetTime=time(firstRow?.fromDate)||null,sourceKey='arbiter:'+slug(key)
    const participants:any[]=[]
    for(const g of rows){const sp=sports.find((s:any)=>s.gender===gender(g));if(!sp)continue;for(const tm of arr(g?.teams)){const local=linkByArb.get(Number(tm?.teamId));if(local)participants.push({sport_id:sp.id,team_id:local,is_section_x:1})}}
    const dedup=[...new Map(participants.map((p:any)=>[`${p.sport_id}:${p.team_id}`,p])).values()]
    summary.push({sourceKey,meetName,date:target,time:meetTime,location,records:rows.length,participants:dedup.length})
    if(!apply||!season)continue

    let meet:any=await db.prepare(`SELECT * FROM cross_country_meets WHERE source_event_key=? LIMIT 1`).bind(sourceKey).first()
    const now=new Date().toISOString(),payload=JSON.stringify(rows)
    if(!meet){
      const id=crypto.randomUUID()
      await db.prepare(`INSERT INTO cross_country_meets (id,season_id,meet_name,meet_date,meet_time,location,meet_type,status,source,source_event_key,source_payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,season.id,meetName,target,meetTime,location,'League',statusFor(rows),'arbiter',sourceKey,payload,now,now).run()
      meet=await db.prepare(`SELECT * FROM cross_country_meets WHERE id=?`).bind(id).first()
    }else if(meet.status!=='Final'){
      await db.prepare(`UPDATE cross_country_meets SET meet_name=?,meet_time=?,location=?,status=?,source_payload=?,updated_at=? WHERE id=?`).bind(meetName,meetTime,location,statusFor(rows),payload,now,meet.id).run()
      meet={...meet,meet_name:meetName,meet_time:meetTime,location,status:statusFor(rows)}
    }
    if(meet&&meet.status!=='Final'){
      await db.prepare(`DELETE FROM cross_country_team_results WHERE meet_id=?`).bind(meet.id).run()
      for(const p of dedup)await db.prepare(`INSERT INTO cross_country_team_results (id,meet_id,sport_id,team_id,team_score,finish_place,is_section_x,created_at) VALUES (?,?,?,?,NULL,NULL,?,?)`).bind(crypto.randomUUID(),meet.id,p.sport_id,p.team_id,p.is_section_x,now).run()
    }
  }
  return NextResponse.json({ok:true,date:target,apply,rawCrossCountryRecords:xc.length,meets:summary})
}
