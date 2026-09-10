import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic='force-dynamic'

function getDb(){const {env}=getCloudflareContext();const db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function GET(){
  try{
    const {results}=await getDb().prepare(`
      SELECT g.id,g.game_date,g.home_score,g.away_score,g.status,g.recap,g.recap_author,
        sp.sport_name,
        ht.team_name AS home_team_name,hs.school_name AS home_school_name,
        at.team_name AS away_team_name,aschool.school_name AS away_school_name
      FROM games g
      LEFT JOIN sports sp ON sp.id=g.sport_id
      LEFT JOIN teams ht ON ht.id=g.home_team_id
      LEFT JOIN schools hs ON hs.id=ht.school_id
      LEFT JOIN teams at ON at.id=g.away_team_id
      LEFT JOIN schools aschool ON aschool.id=at.school_id
      WHERE g.status='Final'
      ORDER BY g.game_date DESC,g.game_time DESC
      LIMIT 50
    `).all()
    const games=(results||[]).map((g:any)=>({
      id:g.id,game_date:g.game_date,home_score:g.home_score,away_score:g.away_score,status:g.status,recap:g.recap,recap_author:g.recap_author,
      sport:{sport_name:g.sport_name},
      home_team:{team_name:g.home_team_name,school:{school_name:g.home_school_name}},
      away_team:{team_name:g.away_team_name,school:{school_name:g.away_school_name}},
    }))
    return NextResponse.json({ok:true,games})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not load recaps'},{status:500})}
}

export async function PATCH(req:NextRequest){
  try{
    const body=await req.json().catch(()=>null),id=String(body?.id||'').trim()
    if(!id)return NextResponse.json({ok:false,error:'id required'},{status:400})
    const recap=String(body?.recap??'').slice(0,12000),author=String(body?.recap_author??'Section X Scoreboard').trim().slice(0,160)
    await getDb().prepare("UPDATE games SET recap=?,recap_author=?,updated_at=datetime('now') WHERE id=?").bind(recap||null,author||'Section X Scoreboard',id).run()
    return NextResponse.json({ok:true})
  }catch(e:any){return NextResponse.json({ok:false,error:e?.message||'Could not save recap'},{status:500})}
}
