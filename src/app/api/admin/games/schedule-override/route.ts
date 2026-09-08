import { NextRequest,NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'

export const dynamic='force-dynamic'

async function authorized(req:NextRequest){
  return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)
}

export async function POST(req:NextRequest){
  if(!await authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const body=await req.json().catch(()=>null)
  const gameId=String(body?.gameId||'')
  const mode=String(body?.mode||'lock')
  if(!gameId)return NextResponse.json({ok:false,error:'Game is required.'},{status:400})
  const db=createAdminClient()

  if(mode==='auto'){
    const {data,error}=await db.from('games').update({
      schedule_override:false,
      schedule_override_note:null,
      schedule_override_updated_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
    }).eq('id',gameId).select('*').single()
    if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
    return NextResponse.json({ok:true,game:data})
  }

  const gameDate=String(body?.gameDate||'')
  const gameTime=body?.gameTime?String(body.gameTime):null
  const location=body?.location==null?null:String(body.location).trim().slice(0,200)
  const homeTeamId=body?.homeTeamId?String(body.homeTeamId):null
  const awayTeamId=body?.awayTeamId?String(body.awayTeamId):null
  const note=String(body?.note||'').trim().slice(0,500)||'Manual schedule override'
  if(!/^\d{4}-\d{2}-\d{2}$/.test(gameDate))return NextResponse.json({ok:false,error:'Valid game date required.'},{status:400})
  if(homeTeamId&&awayTeamId&&homeTeamId===awayTeamId)return NextResponse.json({ok:false,error:'Home and away teams cannot match.'},{status:400})

  const {data:existing,error:existingError}=await db.from('games').select('id,sport_id,home_score,away_score,status').eq('id',gameId).single()
  if(existingError||!existing)return NextResponse.json({ok:false,error:existingError?.message||'Game not found.'},{status:404})

  const ids=[homeTeamId,awayTeamId].filter(Boolean) as string[]
  if(ids.length){
    const {data:teams,error:teamError}=await db.from('teams').select('id,sport_id').in('id',ids)
    if(teamError)return NextResponse.json({ok:false,error:teamError.message},{status:500})
    if((teams||[]).length!==ids.length||(teams||[]).some((t:any)=>t.sport_id!==existing.sport_id)){
      return NextResponse.json({ok:false,error:'Selected teams must belong to the same sport as this game.'},{status:400})
    }
  }

  const patch:any={
    game_date:gameDate,
    game_time:gameTime||null,
    location:location||null,
    home_team_id:homeTeamId,
    away_team_id:awayTeamId,
    external_home_opponent_id:null,
    external_away_opponent_id:null,
    schedule_override:true,
    schedule_override_note:note,
    schedule_override_updated_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
  }
  const {data,error}=await db.from('games').update(patch).eq('id',gameId).select('*').single()
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500})
  await db.from('admin_events').insert({event_type:'schedule_override',details:{game_id:gameId,before:existing,after:patch}})
  return NextResponse.json({ok:true,game:data})
}
