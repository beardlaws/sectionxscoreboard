import { NextRequest,NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getContributorUser } from '@/lib/contributorAuth'

export const dynamic='force-dynamic'
function getDb(){const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable');return db}
function bools(profile:any){if(!profile)return null;return {...profile,can_submit_photos:Boolean(profile.can_submit_photos),can_tag_photos:Boolean(profile.can_tag_photos),can_submit_scores:Boolean(profile.can_submit_scores),can_live_score:Boolean(profile.can_live_score),can_publish_photos:Boolean(profile.can_publish_photos)}}

export async function GET(req:NextRequest){
 try{
  const user=await getContributorUser(req)
  if(!user)return NextResponse.json({ok:true,signedIn:false,profile:null,assignments:[],recent:[]})
  const db=getDb(),profile:any=await db.prepare('SELECT * FROM contributor_profiles WHERE user_id=? LIMIT 1').bind(user.id).first()
  if(!profile)return NextResponse.json({ok:true,signedIn:true,profile:null,assignments:[],recent:[]})
  const [assignmentResult,recentResult]=await Promise.all([
   db.prepare(`SELECT a.id,a.assignment_role,a.notes,a.active,a.created_at,g.id AS game_id,g.game_date,g.game_time,g.status,g.home_score,g.away_score,ht.team_name AS home_name,at.team_name AS away_name,sp.sport_name,sp.gender FROM contributor_game_assignments a JOIN games g ON g.id=a.game_id LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN sports sp ON sp.id=g.sport_id WHERE a.contributor_id=? AND a.active=1 ORDER BY a.created_at DESC`).bind(profile.id).all(),
   db.prepare(`SELECT id,game_id,home_score,away_score,game_status,publication_status,created_at FROM contributor_score_updates WHERE contributor_id=? ORDER BY created_at DESC LIMIT 20`).bind(profile.id).all(),
  ])
  const assignments=(assignmentResult.results||[]).map((r:any)=>({id:r.id,assignment_role:r.assignment_role,notes:r.notes,active:Boolean(r.active),game:{id:r.game_id,game_date:r.game_date,game_time:r.game_time,status:r.status,home_score:r.home_score,away_score:r.away_score,home_team:r.home_name?{team_name:r.home_name}:null,away_team:r.away_name?{team_name:r.away_name}:null,sport:r.sport_name?{sport_name:r.sport_name,gender:r.gender}:null}}))
  return NextResponse.json({ok:true,signedIn:true,profile:bools(profile),assignments,recent:recentResult.results||[]})
 }catch(error:any){console.error('[contributor/dashboard]',error);return NextResponse.json({error:error?.message||'Could not load contributor dashboard.'},{status:500})}
}
