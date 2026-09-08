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
  const designation=body?.designation===null||body?.designation===''?null:String(body?.designation)
  const note=String(body?.note||'').trim().slice(0,500)
  if(!gameId)return NextResponse.json({ok:false,error:'Game is required.'},{status:400})
  if(designation!==null&&!['League','Non-League'].includes(designation))return NextResponse.json({ok:false,error:'Invalid designation.'},{status:400})

  const db=createAdminClient()
  const patch=designation===null
    ? {league_designation:null,league_designation_override:false,league_designation_note:null,league_designation_updated_at:new Date().toISOString(),updated_at:new Date().toISOString()}
    : {league_designation:designation,league_designation_override:true,league_designation_note:note||'Admin override',league_designation_updated_at:new Date().toISOString(),updated_at:new Date().toISOString()}

  const {data,error}=await db.from('games').update(patch).eq('id',gameId).select('id,league_designation,league_designation_override,league_designation_note').single()
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500})

  await db.from('admin_events').insert({
    event_type:'league_designation_override',
    details:{game_id:gameId,designation,override:designation!==null,note:patch.league_designation_note}
  })

  return NextResponse.json({ok:true,game:data})
}
