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
  const mode=String(body?.mode||'lock')
  if(!gameId)return NextResponse.json({ok:false,error:'Game is required.'},{status:400})

  try{
    const db=getDb(),now=new Date().toISOString()
    const existing:any=await db.prepare('SELECT id,sport_id,home_score,away_score,status,game_date,game_time,location,home_team_id,away_team_id,schedule_override,schedule_override_note FROM games WHERE id=? LIMIT 1').bind(gameId).first()
    if(!existing)return NextResponse.json({ok:false,error:'Game not found.'},{status:404})

    if(mode==='auto'){
      await db.prepare('UPDATE games SET schedule_override=0,schedule_override_note=NULL,schedule_override_updated_at=?,updated_at=? WHERE id=?').bind(now,now,gameId).run()
      const game=await db.prepare('SELECT * FROM games WHERE id=? LIMIT 1').bind(gameId).first()
      return NextResponse.json({ok:true,game})
    }

    const gameDate=String(body?.gameDate||'')
    const gameTime=body?.gameTime?String(body.gameTime):null
    const location=body?.location==null?null:String(body.location).trim().slice(0,200)
    const homeTeamId=body?.homeTeamId?String(body.homeTeamId):null
    const awayTeamId=body?.awayTeamId?String(body.awayTeamId):null
    const note=String(body?.note||'').trim().slice(0,500)||'Manual schedule override'
    if(!/^\d{4}-\d{2}-\d{2}$/.test(gameDate))return NextResponse.json({ok:false,error:'Valid game date required.'},{status:400})
    if(homeTeamId&&awayTeamId&&homeTeamId===awayTeamId)return NextResponse.json({ok:false,error:'Home and away teams cannot match.'},{status:400})

    const ids=[homeTeamId,awayTeamId].filter(Boolean) as string[]
    if(ids.length){
      const placeholders=ids.map(()=>'?').join(',')
      const teamResult=await db.prepare(`SELECT id,sport_id FROM teams WHERE id IN (${placeholders})`).bind(...ids).all()
      const teams:any[]=teamResult.results||[]
      if(teams.length!==ids.length||teams.some((t:any)=>t.sport_id!==existing.sport_id))return NextResponse.json({ok:false,error:'Selected teams must belong to the same sport as this game.'},{status:400})
    }

    const after={game_date:gameDate,game_time:gameTime||null,location:location||null,home_team_id:homeTeamId,away_team_id:awayTeamId,external_home_opponent_id:null,external_away_opponent_id:null,schedule_override:true,schedule_override_note:note,schedule_override_updated_at:now,updated_at:now}
    await db.batch([
      db.prepare('UPDATE games SET game_date=?,game_time=?,location=?,home_team_id=?,away_team_id=?,external_home_opponent_id=NULL,external_away_opponent_id=NULL,schedule_override=1,schedule_override_note=?,schedule_override_updated_at=?,updated_at=? WHERE id=?')
        .bind(gameDate,gameTime||null,location||null,homeTeamId,awayTeamId,note,now,now,gameId),
      db.prepare('INSERT INTO admin_events (id,event_type,details,created_at) VALUES (?,?,?,?)')
        .bind(crypto.randomUUID(),'schedule_override',JSON.stringify({game_id:gameId,before:existing,after}),now),
    ])
    const game=await db.prepare('SELECT * FROM games WHERE id=? LIMIT 1').bind(gameId).first()
    return NextResponse.json({ok:true,game})
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'Could not save schedule override.'},{status:500})}
}
