import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'

function db(){const {env}=getCloudflareContext();const d=(env as any).DB;if(!d)throw new Error('Cloudflare D1 binding DB is unavailable');return d}
function clean(v:any){const s=String(v??'').trim();return s||null}

export async function GET(){
 try{
  const d=db()
  const [eventsResult,sportsResult,teamsResult]=await Promise.all([
   d.prepare(`SELECT g.id,g.sport_id,g.season_id,g.event_name,g.event_format,g.game_date,g.game_time,g.location,g.status,g.counts_for_standings,g.notes,s.sport_name,s.gender FROM games g LEFT JOIN sports s ON s.id=g.sport_id WHERE g.event_format IN ('meet','invitational') ORDER BY g.game_date DESC,g.game_time DESC LIMIT 150`).all(),
   d.prepare(`SELECT id,sport_name,gender,season_type FROM sports WHERE active_public=1 ORDER BY sport_name,gender`).all(),
   d.prepare(`SELECT t.id,t.sport_id,t.team_name,sc.school_name FROM teams t LEFT JOIN schools sc ON sc.id=t.school_id WHERE t.active=1 ORDER BY sc.school_name,t.team_name`).all()
  ])
  const events:any[]=eventsResult.results||[]
  const ids=events.map(e=>e.id)
  let results:any[]=[]
  if(ids.length){const marks=ids.map(()=>'?').join(',');const r=await d.prepare(`SELECT r.*,t.team_name,sc.school_name FROM event_team_results r LEFT JOIN teams t ON t.id=r.team_id LEFT JOIN schools sc ON sc.id=t.school_id WHERE r.game_id IN (${marks}) ORDER BY r.game_id,COALESCE(r.placement,9999),COALESCE(r.score,999999),r.display_name`).bind(...ids).all();results=r.results||[]}
  const byGame=new Map<string,any[]>();for(const r of results){const a=byGame.get(r.game_id)||[];a.push({...r,name:r.school_name||r.team_name||r.display_name});byGame.set(r.game_id,a)}
  return NextResponse.json({ok:true,events:events.map(e=>({...e,counts_for_standings:Boolean(e.counts_for_standings),participants:byGame.get(e.id)||[]})),sports:sportsResult.results||[],teams:(teamsResult.results||[]).map((t:any)=>({...t,name:t.school_name||t.team_name}))})
 }catch(e:any){console.error('[admin/meets GET]',e);return NextResponse.json({ok:false,error:e?.message||'Could not load meets'},{status:500})}
}

export async function POST(req:NextRequest){
 try{
  const d=db(),body=await req.json().catch(()=>({})),action=String(body.action||'save')
  if(action==='delete'){
   const id=String(body.id||'');if(!id)return NextResponse.json({ok:false,error:'Missing event id'},{status:400})
   await d.prepare('DELETE FROM games WHERE id=? AND event_format IN (\'meet\',\'invitational\')').bind(id).run();return NextResponse.json({ok:true})
  }
  const id=String(body.id||crypto.randomUUID()),eventName=clean(body.eventName),sportId=clean(body.sportId),gameDate=clean(body.gameDate),gameTime=clean(body.gameTime),location=clean(body.location),notes=clean(body.notes),status=String(body.status||'Scheduled'),eventFormat=body.eventFormat==='meet'?'meet':'invitational',counts=body.countsForStandings?1:0
  if(!eventName||!sportId||!gameDate)return NextResponse.json({ok:false,error:'Event name, sport and date are required.'},{status:400})
  const participants=Array.isArray(body.participants)?body.participants:[]
  if(participants.length<2)return NextResponse.json({ok:false,error:'A meet needs at least two participating teams.'},{status:400})
  const sport:any=await d.prepare('SELECT season_type FROM sports WHERE id=? LIMIT 1').bind(sportId).first(),season:any=sport?.season_type?await d.prepare('SELECT id FROM seasons WHERE is_active=1 AND season_type=? ORDER BY year DESC LIMIT 1').bind(sport.season_type).first():null
  const existing:any=await d.prepare('SELECT id FROM games WHERE id=? LIMIT 1').bind(id).first()
  if(existing){await d.prepare(`UPDATE games SET season_id=?,sport_id=?,event_name=?,event_format=?,game_date=?,game_time=?,location=?,status=?,counts_for_standings=?,notes=?,home_team_id=NULL,away_team_id=NULL,home_score=NULL,away_score=NULL,verification_status='Verified',updated_at=datetime('now') WHERE id=?`).bind(season?.id||null,sportId,eventName,eventFormat,gameDate,gameTime,location,status,counts,notes,id).run();await d.prepare('DELETE FROM event_team_results WHERE game_id=?').bind(id).run()}
  else{await d.prepare(`INSERT INTO games (id,season_id,sport_id,game_date,game_time,location,status,verification_status,source,notes,event_name,event_format,counts_for_standings,neutral_site) VALUES (?,?,?,?,?,?,?,'Verified','admin',?,?,?,?,1)`).bind(id,season?.id||null,sportId,gameDate,gameTime,location,status,notes,eventName,eventFormat,counts).run()}
  for(let i=0;i<participants.length;i++){
   const p=participants[i]||{},teamId=clean(p.teamId),name=clean(p.name),placement=p.placement===''||p.placement==null?null:Number(p.placement),score=p.score===''||p.score==null?null:Number(p.score),points=p.points===''||p.points==null?null:Number(p.points)
   if(!teamId&&!name)continue
   await d.prepare(`INSERT INTO event_team_results (id,game_id,team_id,display_name,placement,score,points,notes) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,teamId,name,Number.isFinite(placement)?placement:null,Number.isFinite(score)?score:null,Number.isFinite(points)?points:null,clean(p.notes)).run()
  }
  return NextResponse.json({ok:true,id})
 }catch(e:any){console.error('[admin/meets POST]',e);return NextResponse.json({ok:false,error:e?.message||'Could not save meet'},{status:500})}
}
