import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest,NextResponse } from 'next/server'
import { ADMIN_SESSION_COOKIE,verifyAdminSession } from '@/lib/admin-auth'

export const dynamic='force-dynamic'

async function authorized(req:NextRequest){
  return verifyAdminSession(req.cookies.get(ADMIN_SESSION_COOKIE)?.value,process.env.ADMIN_SESSION_TOKEN)
}
function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function POST(req:NextRequest){
  if(!await authorized(req))return NextResponse.json({ok:false,error:'Unauthorized'},{status:401})
  const body=await req.json().catch(()=>null)
  const gameId=String(body?.gameId||'')
  const designation=body?.designation===null||body?.designation===''?null:String(body?.designation)
  const note=String(body?.note||'').trim().slice(0,500)
  if(!gameId)return NextResponse.json({ok:false,error:'Game is required.'},{status:400})
  if(designation!==null&&!['League','Non-League'].includes(designation))return NextResponse.json({ok:false,error:'Invalid designation.'},{status:400})

  try{
    const db=getDb(),now=new Date().toISOString()
    const patch=designation===null
      ? {league_designation:null,league_designation_override:0,league_designation_note:null,league_designation_updated_at:now,updated_at:now}
      : {league_designation:designation,league_designation_override:1,league_designation_note:note||'Admin override',league_designation_updated_at:now,updated_at:now}
    const existing:any=await db.prepare('SELECT id FROM games WHERE id=? LIMIT 1').bind(gameId).first()
    if(!existing)return NextResponse.json({ok:false,error:'Game not found.'},{status:404})

    const eventId=crypto.randomUUID()
    await db.batch([
      db.prepare('UPDATE games SET league_designation=?,league_designation_override=?,league_designation_note=?,league_designation_updated_at=?,updated_at=? WHERE id=?')
        .bind(patch.league_designation,patch.league_designation_override,patch.league_designation_note,patch.league_designation_updated_at,patch.updated_at,gameId),
      db.prepare('INSERT INTO admin_events (id,event_type,details,created_at) VALUES (?,?,?,?)')
        .bind(eventId,'league_designation_override',JSON.stringify({game_id:gameId,designation,override:designation!==null,note:patch.league_designation_note}),now),
    ])
    const game:any=await db.prepare('SELECT id,league_designation,league_designation_override,league_designation_note FROM games WHERE id=? LIMIT 1').bind(gameId).first()
    if(game)game.league_designation_override=Boolean(game.league_designation_override)
    return NextResponse.json({ok:true,game})
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'Could not update league designation.'},{status:500})}
}
