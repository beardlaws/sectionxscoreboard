import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { arbiterApi } from '@/lib/arbiter/client'
import { SECTION_X_SCHOOL_IDS } from '@/lib/arbiter/schedule-intelligence'

export const dynamic='force-dynamic'
export const maxDuration=120
const KEY='sx-roster-repair-20260828-7f3c91'
const arr=(v:any)=>Array.isArray(v)?v:v==null?[]:[v]
const clean=(v:any)=>String(v||'').trim()
const norm=(v:any)=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()
const day=(v:any)=>String(v||'').slice(0,10)
const time=(v:any)=>String(v||'').slice(11,16)
const slug=(v:any)=>norm(v).replace(/\s+/g,'-').slice(0,120)
const isXC=(g:any)=>norm(g?.sportName).includes('cross country')
const gender=(g:any)=>norm(g?.gender).includes('girl')?'Girls':norm(g?.gender).includes('boy')?'Boys':null
const baseTitle=(g:any)=>{
  const raw=clean(g?.title)||clean(g?.siteName)||'Cross Country Meet'
  return raw.replace(/\b(boys|girls|varsity|cross country|xc)\b/ig,' ').replace(/\s+/g,' ').trim()||'Cross Country Meet'
}
const statusFor=(rows:any[])=>{
  if(rows.some(g=>['cancelled','canceled'].includes(norm(g?.status)))) return 'Canceled'
  if(rows.some(g=>norm(g?.status).includes('live'))) return 'Live'
  return 'Scheduled'
}

export async function GET(req:NextRequest){
  if(req.nextUrl.searchParams.get('key')!==KEY)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const target=req.nextUrl.searchParams.get('date')||new Date().toISOString().slice(0,10)
  const apply=req.nextUrl.searchParams.get('apply')==='1'
  const start=`${target}T00:00:00.000Z`, end=`${target}T23:59:59.999Z`
  const raw=arr(await arbiterApi.games({SchoolIds:Array.from(SECTION_X_SCHOOL_IDS),DateFilter:'Range',GameStartDate:start,GameEndDate:end,IncludeDeletedGames:false,IncludePendingInformation:false}))
  const xc=raw.filter(isXC)
  const groups=new Map<string,any[]>()
  for(const g of xc){
    const k=[day(g.fromDate),time(g.fromDate),norm(g.siteName||g.subSiteName),norm(baseTitle(g))].join('|')
    if(!groups.has(k))groups.set(k,[])
    groups.get(k)!.push(g)
  }
  const db=createAdminClient()
  const {data:season}=await db.from('seasons').select('id,name').eq('is_active',true).maybeSingle()
  const {data:sports}=await db.from('sports').select('id,slug,gender').in('slug',['boys-cross-country','girls-cross-country'])
  const {data:links}=await db.from('arbiter_team_links').select('team_id,arbiter_team_id')
  const linkByArb=new Map((links||[]).map((x:any)=>[Number(x.arbiter_team_id),x.team_id]))
  const summary:any[]=[]
  for(const [key,rows] of groups){
    const first=rows[0]
    const meetName=baseTitle(first)
    const location=clean(first?.subSiteName||first?.siteName)||null
    const meetTime=time(first?.fromDate)||null
    const sourceKey='arbiter:'+slug(key)
    const participants:any[]=[]
    for(const g of rows){
      const sp=(sports||[]).find((s:any)=>s.gender===gender(g))
      if(!sp)continue
      for(const tm of arr(g?.teams)){
        const local=linkByArb.get(Number(tm?.teamId))
        if(local) participants.push({sport_id:sp.id,team_id:local,is_section_x:true})
      }
    }
    const dedup=[...new Map(participants.map((p:any)=>[`${p.sport_id}:${p.team_id}`,p])).values()]
    summary.push({sourceKey,meetName,date:target,time:meetTime,location,records:rows.length,participants:dedup.length})
    if(!apply||!season)continue
    let {data:meet}=await db.from('cross_country_meets').select('*').eq('source_event_key',sourceKey).maybeSingle()
    if(!meet){
      const ins=await db.from('cross_country_meets').insert({season_id:season.id,meet_name:meetName,meet_date:target,meet_time:meetTime,location,meet_type:'League',status:statusFor(rows),source:'arbiter',source_event_key:sourceKey,source_payload:rows}).select('*').single()
      meet=ins.data
    } else if(meet.status!=='Final'){
      const upd=await db.from('cross_country_meets').update({meet_name:meetName,meet_time:meetTime,location,status:statusFor(rows),source_payload:rows,updated_at:new Date().toISOString()}).eq('id',meet.id).select('*').single()
      meet=upd.data
    }
    if(meet&&meet.status!=='Final'){
      await db.from('cross_country_team_results').delete().eq('meet_id',meet.id)
      if(dedup.length) await db.from('cross_country_team_results').insert(dedup.map((p:any)=>({...p,meet_id:meet.id,team_score:null,finish_place:null})))
    }
  }
  return NextResponse.json({ok:true,date:target,apply,rawCrossCountryRecords:xc.length,meets:summary})
}
