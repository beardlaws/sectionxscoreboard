import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

function allowed(profile:any,role:string){
  if(role==='photographer')return Boolean(profile.can_submit_photos)
  if(role==='score-reporter')return Boolean(profile.can_submit_scores)
  if(role==='live-score')return Boolean(profile.can_live_score)
  return Boolean(profile.can_submit_photos||profile.can_submit_scores)
}

export async function GET(){
  const auth=createClient()
  const {data:{user}}=await auth.auth.getUser()
  if(!user)return NextResponse.json({error:'Sign in required.'},{status:401})
  const db=createAdminClient()
  const {data:profile}=await db.from('contributor_profiles').select('*').eq('user_id',user.id).maybeSingle()
  if(!profile||profile.status!=='approved')return NextResponse.json({error:'Approved contributor account required.'},{status:403})
  const today=new Date().toISOString().slice(0,10),future=new Date(Date.now()+1000*60*60*24*30).toISOString().slice(0,10)
  const {data,error}=await db.from('contributor_coverage_requests').select(`id,game_id,coverage_role,status,notes,created_at,game:games(id,game_date,game_time,status,home_team:teams!games_home_team_id_fkey(team_name),away_team:teams!games_away_team_id_fkey(team_name),sport:sports(sport_name,gender))`).eq('status','open').gte('game.game_date',today).lte('game.game_date',future).order('created_at',{ascending:false})
  if(error)return NextResponse.json({error:error.message},{status:500})
  return NextResponse.json({ok:true,requests:(data||[]).filter((r:any)=>r.game&&allowed(profile,r.coverage_role))})
}

export async function POST(req:NextRequest){
  const auth=createClient()
  const {data:{user}}=await auth.auth.getUser()
  if(!user)return NextResponse.json({error:'Sign in required.'},{status:401})
  const body=await req.json(),requestId=String(body?.requestId||'')
  if(!requestId)return NextResponse.json({error:'Coverage request is required.'},{status:400})
  const db=createAdminClient()
  const {data:profile}=await db.from('contributor_profiles').select('*').eq('user_id',user.id).maybeSingle()
  if(!profile||profile.status!=='approved')return NextResponse.json({error:'Approved contributor account required.'},{status:403})
  const {data:requestRow,error:requestError}=await db.from('contributor_coverage_requests').select('id,game_id,coverage_role,status').eq('id',requestId).maybeSingle()
  if(requestError||!requestRow)return NextResponse.json({error:'Coverage request not found.'},{status:404})
  if(requestRow.status!=='open')return NextResponse.json({error:'That coverage opportunity is no longer open.'},{status:409})
  if(!allowed(profile,requestRow.coverage_role))return NextResponse.json({error:'Your contributor permissions do not allow this coverage role.'},{status:403})

  const now=new Date().toISOString()
  const {data:claimed,error:claimError}=await db.from('contributor_coverage_requests').update({status:'claimed',claimed_by:profile.id,claimed_at:now,updated_at:now}).eq('id',requestId).eq('status','open').select('id,game_id,coverage_role').maybeSingle()
  if(claimError)return NextResponse.json({error:claimError.message},{status:500})
  if(!claimed)return NextResponse.json({error:'Another contributor claimed this game first.'},{status:409})

  const {error:assignmentError}=await db.from('contributor_game_assignments').upsert({contributor_id:profile.id,game_id:claimed.game_id,assignment_role:claimed.coverage_role,active:true},{onConflict:'contributor_id,game_id,assignment_role'})
  if(assignmentError){
    await db.from('contributor_coverage_requests').update({status:'open',claimed_by:null,claimed_at:null,updated_at:new Date().toISOString()}).eq('id',claimed.id)
    return NextResponse.json({error:assignmentError.message},{status:500})
  }

  await Promise.all([
    db.from('contributor_activity').insert({contributor_id:profile.id,event_type:'coverage-claimed',entity_type:'game',entity_id:claimed.game_id,details:{coverageRequestId:claimed.id,role:claimed.coverage_role}}),
    db.from('contributor_profiles').update({last_active_at:now,updated_at:now}).eq('id',profile.id),
  ])
  return NextResponse.json({ok:true,claimed:true,gameId:claimed.game_id,role:claimed.coverage_role})
}
