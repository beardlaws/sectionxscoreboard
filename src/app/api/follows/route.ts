import { NextRequest,NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic='force-dynamic'
function emailOf(value:unknown){const email=String(value||'').trim().toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:''}
function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}

export async function POST(req:NextRequest){
 try{
  const body=await req.json(),email=emailOf(body?.email),teamId=body?.teamId?String(body.teamId):null,athleteId=body?.athleteId?String(body.athleteId):null
  if(!email)return NextResponse.json({error:'Enter a valid email address.'},{status:400})
  if((teamId?1:0)+(athleteId?1:0)!==1)return NextResponse.json({error:'Choose one team or athlete to follow.'},{status:400})
  const db=getDb(),prefs={alert_finals:body?.preferences?.finals!==false?1:0,alert_schedule_changes:body?.preferences?.scheduleChanges!==false?1:0,alert_live:body?.preferences?.live===true?1:0,alert_photos:body?.preferences?.photos!==false?1:0}
  const existing:any=teamId?await db.prepare('SELECT id,manage_token FROM fan_follow_preferences WHERE lower(email)=lower(?) AND team_id=? LIMIT 1').bind(email,teamId).first():await db.prepare('SELECT id,manage_token FROM fan_follow_preferences WHERE lower(email)=lower(?) AND athlete_id=? LIMIT 1').bind(email,athleteId).first()
  let manageToken=existing?.manage_token||crypto.randomUUID()
  if(existing?.id)await db.prepare('UPDATE fan_follow_preferences SET email=?,alert_finals=?,alert_schedule_changes=?,alert_live=?,alert_photos=?,active=1,manage_token=COALESCE(manage_token,?),updated_at=datetime(\'now\') WHERE id=?').bind(email,prefs.alert_finals,prefs.alert_schedule_changes,prefs.alert_live,prefs.alert_photos,manageToken,existing.id).run()
  else await db.prepare('INSERT INTO fan_follow_preferences (id,email,team_id,athlete_id,alert_finals,alert_schedule_changes,alert_live,alert_photos,active,manage_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,datetime(\'now\'),datetime(\'now\'))').bind(crypto.randomUUID(),email,teamId,athleteId,prefs.alert_finals,prefs.alert_schedule_changes,prefs.alert_live,prefs.alert_photos,manageToken).run()
  if(teamId&&prefs.alert_finals){const team:any=await db.prepare('SELECT school_id FROM teams WHERE id=? LIMIT 1').bind(teamId).first();if(team?.school_id){const sub:any=await db.prepare('SELECT id FROM score_alert_subscriptions WHERE lower(email)=lower(?) AND school_id=? LIMIT 1').bind(email,team.school_id).first();if(!sub?.id)await db.prepare('INSERT INTO score_alert_subscriptions (id,email,school_id,all_section_x,confirmed,created_at) VALUES (?,?,?,0,1,datetime(\'now\'))').bind(crypto.randomUUID(),email,team.school_id).run()}}
  return NextResponse.json({ok:true,manageToken})
 }catch(error){console.error('follow api',error);return NextResponse.json({error:'Could not save your follow right now.'},{status:500})}
}
