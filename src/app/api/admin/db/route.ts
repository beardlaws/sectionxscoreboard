import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Keep this intentionally explicit. The browser helper can only reach tables that are
// part of the Cloudflare migration and are appropriate for admin CRUD operations.
const ALLOWED_TABLES = new Set([
  'schools','sports','seasons','teams','team_seasons','external_opponents','games','submissions',
  'photos','shoutouts','sponsors','site_settings','athletes','coaches','roster_entries','team_coaches',
  'spotlights','athlete_of_week','weekly_recaps','game_period_scores','stat_definitions','game_team_stats',
  'game_athlete_stats','photo_athletes','photo_tag_suggestions','playoff_tournaments','playoff_games',
  'fan_power_rank_ballots','fan_power_rank_snapshots','fan_top_play_nominations','fan_school_support',
  'fan_school_support_snapshots','fan_game_votes','fan_game_vote_snapshots','athlete_nominations',
  'advertise_inquiries','game_import_sources','correction_requests','arbiter_team_links','arbiter_game_links',
  'arbiter_sync_runs','arbiter_sync_actions','arbiter_health_checks','arbiter_automation_runs',
  'arbiter_roster_freshness','arbiter_roster_automation_runs','arbiter_school_mappings','arbiter_team_mappings',
  'arbiter_shared_event_ids'
])

function qid(value:string){return `"${value.replaceAll('"','""')}"`}
function dbValue(value:any){
  if(value===undefined)return null
  if(typeof value==='boolean')return value?1:0
  if(value!==null&&typeof value==='object')return JSON.stringify(value)
  return value
}
async function columnsFor(db:any,table:string){
  const result=await db.prepare(`PRAGMA table_info(${qid(table)})`).all()
  return new Set((result.results||[]).map((r:any)=>String(r.name)))
}
function cleanObject(input:any,columns:Set<string>){
  const out:Record<string,any>={}
  for(const [key,value] of Object.entries(input||{})){
    if(columns.has(key)&&value!==undefined)out[key]=dbValue(value)
  }
  return out
}
function optionalMatchClause(match:Record<string,any>|undefined,columns:Set<string>){
  const entries=Object.entries(match||{}).filter(([key])=>columns.has(key))
  return {sql:entries.map(([key])=>`${qid(key)}=?`).join(' AND '),values:entries.map(([,value])=>dbValue(value))}
}
function requiredMatchClause(match:Record<string,any>,columns:Set<string>){
  const result=optionalMatchClause(match,columns)
  if(!result.sql)throw new Error('A valid match is required for update/delete')
  return result
}

// POST /api/admin/db
// Middleware protects /api/admin/* using the existing admin session cookie.
// Body supports CRUD plus a constrained select for simple admin tables.
export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>null)
  const action=String(body?.action||''),table=String(body?.table||'')
  if(!action||!ALLOWED_TABLES.has(table))return NextResponse.json({error:'Unsupported admin database request'},{status:400})

  try{
    const {env}=getCloudflareContext(),db=(env as any).DB
    if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
    const columns=await columnsFor(db,table)
    if(!columns.size)throw new Error(`D1 table is unavailable: ${table}`)

    if(action==='select'){
      const requested=Array.isArray(body.columns)?body.columns.map(String).filter((c:string)=>columns.has(c)):[]
      const selectSql=requested.length?requested.map(qid).join(','):'*'
      const where=optionalMatchClause(body.match,columns)
      const orderBy=columns.has(String(body.orderBy||''))?String(body.orderBy):null
      const direction=String(body.direction||'asc').toLowerCase()==='desc'?'DESC':'ASC'
      const limit=Math.max(1,Math.min(1000,Number(body.limit)||500))
      const sql=`SELECT ${selectSql} FROM ${qid(table)}${where.sql?` WHERE ${where.sql}`:''}${orderBy?` ORDER BY ${qid(orderBy)} ${direction}`:''} LIMIT ${limit}`
      const result=await db.prepare(sql).bind(...where.values).all()
      return NextResponse.json({ok:true,data:result.results||[]})
    }

    if(action==='insert'){
      const rows=Array.isArray(body.data)?body.data:[body.data]
      const output:any[]=[]
      for(const raw of rows){
        const data=cleanObject(raw,columns)
        if(columns.has('id')&&!('id' in data))data.id=crypto.randomUUID()
        const finalEntries=Object.entries(data)
        if(!finalEntries.length)throw new Error('No valid insert fields supplied')
        const sql=`INSERT INTO ${qid(table)} (${finalEntries.map(([k])=>qid(k)).join(',')}) VALUES (${finalEntries.map(()=>'?').join(',')})`
        await db.prepare(sql).bind(...finalEntries.map(([,v])=>v)).run()
        output.push(data)
      }
      return NextResponse.json({ok:true,data:Array.isArray(body.data)?output:output[0]})
    }

    if(action==='update'){
      const data=cleanObject(body.data,columns),entries=Object.entries(data)
      if(!entries.length)throw new Error('No valid update fields supplied')
      const where=requiredMatchClause(body.match,columns)
      const sql=`UPDATE ${qid(table)} SET ${entries.map(([k])=>`${qid(k)}=?`).join(',')} WHERE ${where.sql}`
      const result=await db.prepare(sql).bind(...entries.map(([,v])=>v),...where.values).run()
      return NextResponse.json({ok:true,data:null,changes:Number(result.meta?.changes||0)})
    }

    if(action==='delete'){
      const where=requiredMatchClause(body.match,columns)
      const result=await db.prepare(`DELETE FROM ${qid(table)} WHERE ${where.sql}`).bind(...where.values).run()
      return NextResponse.json({ok:true,data:null,changes:Number(result.meta?.changes||0)})
    }

    if(action==='upsert'){
      const data=cleanObject(body.data,columns)
      if(columns.has('id')&&!('id' in data))data.id=crypto.randomUUID()
      const entries=Object.entries(data)
      if(!entries.length)throw new Error('No valid upsert fields supplied')
      const conflict=String(body.onConflict||'id').split(',').map((v:string)=>v.trim()).filter(Boolean)
      if(!conflict.length||conflict.some((key:string)=>!columns.has(key)))throw new Error('Invalid conflict target')
      const updateKeys=entries.map(([k])=>k).filter(k=>!conflict.includes(k))
      const tail=updateKeys.length?`DO UPDATE SET ${updateKeys.map(k=>`${qid(k)}=excluded.${qid(k)}`).join(',')}`:'DO NOTHING'
      const sql=`INSERT INTO ${qid(table)} (${entries.map(([k])=>qid(k)).join(',')}) VALUES (${entries.map(()=>'?').join(',')}) ON CONFLICT (${conflict.map(qid).join(',')}) ${tail}`
      await db.prepare(sql).bind(...entries.map(([,v])=>v)).run()
      return NextResponse.json({ok:true,data})
    }

    return NextResponse.json({error:'Invalid action'},{status:400})
  }catch(error:any){
    console.error('[admin/db]',error)
    return NextResponse.json({error:error?.message||'D1 admin database error'},{status:500})
  }
}
