import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic='force-dynamic'

function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function GET(req:NextRequest){
  try{
    const db=getDb(),sp=req.nextUrl.searchParams
    const seasonId=sp.get('seasonId')||'',sportId=sp.get('sportId')||'',status=sp.get('status')||'',playoff=sp.get('playoff')||'',startDate=sp.get('startDate')||'',endDate=sp.get('endDate')||''
    const where:string[]=[],values:any[]=[]
    if(seasonId){where.push('g.season_id=?');values.push(seasonId)}
    if(sportId){where.push('g.sport_id=?');values.push(sportId)}
    if(status){where.push('g.status=?');values.push(status)}
    if(startDate){where.push('g.game_date>=?');values.push(startDate)}
    if(endDate){where.push('g.game_date<=?');values.push(endDate)}
    if(playoff==='playoff')where.push('g.is_playoff=1')
    if(playoff==='regular')where.push('COALESCE(g.is_playoff,0)=0')
    const sql=`SELECT g.*,
      sp.sport_name,
      ht.team_name AS home_team_name,hs.school_name AS home_school_name,hs.primary_color AS home_primary_color,
      at.team_name AS away_team_name,aschool.school_name AS away_school_name,aschool.primary_color AS away_primary_color,
      eh.name AS external_home_name,ea.name AS external_away_name
      FROM games g
      LEFT JOIN sports sp ON sp.id=g.sport_id
      LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN schools hs ON hs.id=ht.school_id
      LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN schools aschool ON aschool.id=at.school_id
      LEFT JOIN external_opponents eh ON eh.id=g.external_home_opponent_id
      LEFT JOIN external_opponents ea ON ea.id=g.external_away_opponent_id
      ${where.length?`WHERE ${where.join(' AND ')}`:''}
      ORDER BY g.game_date ${startDate||endDate?'ASC':'DESC'},g.game_time ASC LIMIT 500`
    const result=await db.prepare(sql).bind(...values).all()
    const games=(result.results||[]).map((g:any)=>({
      ...g,featured:Boolean(g.featured),game_of_the_night:Boolean(g.game_of_the_night),neutral_site:Boolean(g.neutral_site),is_playoff:Boolean(g.is_playoff),result_exempt:Boolean(g.result_exempt),
      sport:g.sport_id?{id:g.sport_id,sport_name:g.sport_name}:null,
      home_team:g.home_team_id?{id:g.home_team_id,team_name:g.home_team_name,school:{school_name:g.home_school_name,primary_color:g.home_primary_color}}:null,
      away_team:g.away_team_id?{id:g.away_team_id,team_name:g.away_team_name,school:{school_name:g.away_school_name,primary_color:g.away_primary_color}}:null,
      external_home:g.external_home_opponent_id?{name:g.external_home_name}:null,
      external_away:g.external_away_opponent_id?{name:g.external_away_name}:null,
    }))
    return NextResponse.json({ok:true,games})
  }catch(error:any){return NextResponse.json({ok:false,error:error?.message||'Could not load games'},{status:500})}
}

export async function PATCH(req:NextRequest){
  try{
    const body=await req.json().catch(()=>null),db=getDb()
    if(body?.action==='game-of-the-night'){
      const id=String(body.id||''),value=Boolean(body.value),date=String(body.gameDate||'')
      if(!id)return NextResponse.json({error:'id required'},{status:400})
      if(value&&date)await db.prepare('UPDATE games SET game_of_the_night=0,updated_at=datetime(\'now\') WHERE game_date=? AND id<>?').bind(date,id).run()
      await db.prepare('UPDATE games SET game_of_the_night=?,updated_at=datetime(\'now\') WHERE id=?').bind(value?1:0,id).run()
      return NextResponse.json({ok:true})
    }
    return NextResponse.json({error:'Unsupported action'},{status:400})
  }catch(error:any){return NextResponse.json({error:error?.message||'Update failed'},{status:500})}
}
