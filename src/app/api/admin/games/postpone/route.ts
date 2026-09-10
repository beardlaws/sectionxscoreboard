import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic='force-dynamic'

function getDb(){const {env}=getCloudflareContext();const db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function GET(req:NextRequest){
  try{
    const date=String(req.nextUrl.searchParams.get('date')||'').trim()
    const db=getDb()
    const where=date?'AND g.game_date=?':''
    const stmt=db.prepare(`
      SELECT g.id,g.game_date,g.game_time,g.status,sp.sport_name,
        hs.school_name AS home_school_name,ht.team_name AS home_team_name,
        aschool.school_name AS away_school_name,at.team_name AS away_team_name
      FROM games g
      LEFT JOIN sports sp ON sp.id=g.sport_id
      LEFT JOIN teams ht ON ht.id=g.home_team_id
      LEFT JOIN schools hs ON hs.id=ht.school_id
      LEFT JOIN teams at ON at.id=g.away_team_id
      LEFT JOIN schools aschool ON aschool.id=at.school_id
      WHERE g.status IN ('Scheduled','Postponed') ${where}
      ORDER BY g.game_date,g.game_time
      LIMIT 100
    `)
    const {results}=date?await stmt.bind(date).all():await stmt.all()
    const games=(results||[]).map((g:any)=>({
      id:g.id,game_date:g.game_date,game_time:g.game_time,status:g.status,
      sport:{sport_name:g.sport_name},
      home_team:{team_name:g.home_team_name,school:{school_name:g.home_school_name}},
      away_team:{team_name:g.away_team_name,school:{school_name:g.away_school_name}},
    }))
    return NextResponse.json({ok:true,games})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not load games'},{status:500})}
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json().catch(()=>null)
    const ids=Array.isArray(body?.ids)?body.ids.map((x:any)=>String(x||'').trim()).filter(Boolean):[]
    const rescheduleDate=String(body?.rescheduleDate||'').trim()||null
    if(!ids.length)return NextResponse.json({ok:false,error:'No games selected'},{status:400})
    const db=getDb(),statements=[]
    for(const id of ids){
      statements.push(db.prepare(`UPDATE games SET status='Postponed',notes=?,rescheduled_date=?,updated_at=datetime('now') WHERE id=?`).bind(rescheduleDate?`Rescheduled to ${rescheduleDate}`:'Postponed',rescheduleDate,id))
    }
    await db.batch(statements)
    return NextResponse.json({ok:true,updated:ids.length})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not postpone games'},{status:500})}
}
