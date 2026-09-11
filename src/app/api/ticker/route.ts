import { NextRequest,NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'
function db(){const {env}=getCloudflareContext(),d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}
function today(){return new Date().toISOString().slice(0,10)}

export async function GET(req:NextRequest){
 try{
  const date=String(req.nextUrl.searchParams.get('date')||today()).slice(0,10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return NextResponse.json({error:'Invalid date.'},{status:400})
  const database=db(),past=date<today()
  const rows=(await database.prepare(`SELECT g.id,g.game_date,g.game_time,g.home_score,g.away_score,g.status,g.season_id,g.sport_id,g.home_team_id,g.away_team_id,sp.sport_name,sp.gender,ht.team_name AS home_team_name,hs.school_name AS home_school_name,hs.alias AS home_alias,hs.primary_color AS home_color,at.team_name AS away_team_name,aschool.school_name AS away_school_name,aschool.alias AS away_alias,aschool.primary_color AS away_color,eh.name AS external_home_name,ea.name AS external_away_name FROM games g LEFT JOIN sports sp ON sp.id=g.sport_id LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN schools hs ON hs.id=ht.school_id LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN schools aschool ON aschool.id=at.school_id LEFT JOIN external_opponents eh ON eh.id=g.external_home_opponent_id LEFT JOIN external_opponents ea ON ea.id=g.external_away_opponent_id WHERE g.game_date=? AND lower(COALESCE(g.status,'')) NOT IN ('canceled','cancelled') ${past?"AND lower(COALESCE(g.status,''))='final'":''} ORDER BY COALESCE(g.game_time,'99:99') ASC`).bind(date).all()).results||[]
  const games=rows.map((r:any)=>({id:r.id,game_date:r.game_date,game_time:r.game_time,home_score:r.home_score,away_score:r.away_score,status:r.status,season_id:r.season_id,sport_id:r.sport_id,sport:r.sport_name?{sport_name:r.sport_name,gender:r.gender}:null,home_team:r.home_team_id?{id:r.home_team_id,team_name:r.home_team_name,school:r.home_school_name?{school_name:r.home_school_name,alias:r.home_alias,primary_color:r.home_color}:null}:null,away_team:r.away_team_id?{id:r.away_team_id,team_name:r.away_team_name,school:r.away_school_name?{school_name:r.away_school_name,alias:r.away_alias,primary_color:r.away_color}:null}:null,external_home:r.external_home_name?{name:r.external_home_name}:null,external_away:r.external_away_name?{name:r.external_away_name}:null}))
  const records:Record<string,string>={}
  const seen=new Set<string>()
  for(const g of games as any[]){for(const team of [g.home_team,g.away_team]){if(!team?.id||!g.season_id||!g.sport_id||seen.has(team.id))continue;seen.add(team.id);const result=(await database.prepare(`SELECT home_team_id,away_team_id,home_score,away_score FROM games WHERE season_id=? AND sport_id=? AND lower(COALESCE(status,''))='final' AND (home_team_id=? OR away_team_id=?)`).bind(g.season_id,g.sport_id,team.id,team.id).all()).results||[];const golf=String(g.sport?.sport_name||'').toLowerCase().includes('golf');let w=0,l=0;for(const x of result as any[]){if(x.home_score==null||x.away_score==null)continue;const mine=x.home_team_id===team.id?Number(x.home_score):Number(x.away_score),opp=x.home_team_id===team.id?Number(x.away_score):Number(x.home_score);if(golf?mine<opp:mine>opp)w++;else if(mine!==opp)l++}records[team.id]=`${w}-${l}`}}
  return NextResponse.json({ok:true,games,records})
 }catch(error:any){console.error('[ticker]',error);return NextResponse.json({error:error?.message||'Could not load ticker.'},{status:500})}
}
