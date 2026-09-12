import { getCloudflareContext } from '@opennextjs/cloudflare'
import ContributorAdmin from './ContributorAdmin'
import CoverageBoard from './CoverageBoard'

export const revalidate=0
function parse(v:any){if(v==null)return v;if(typeof v!=='string')return v;try{return JSON.parse(v)}catch{return v}}
export default async function ContributorsAdminPage(){
 const {env}=getCloudflareContext(),db=(env as any).DB;if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
 const today=new Date().toISOString().slice(0,10),future=new Date(Date.now()+1000*60*60*24*30).toISOString().slice(0,10)
 const [accountsResult,profilesResult,gamesResult,pendingResult,assignmentsResult,coverageResult]=await Promise.all([
  db.prepare(`SELECT a.id,a.email,a.display_name,a.verified_at,a.created_at,a.updated_at,COALESCE(a.claim_required,0) AS claim_required,cp.id AS profile_id,cp.status AS profile_status,cp.public_credit_name,cp.school_id FROM contributor_auth_accounts a LEFT JOIN contributor_profiles cp ON cp.user_id=a.id ORDER BY a.created_at DESC`).all(),
  db.prepare(`SELECT cp.*,s.id AS school_join_id,s.school_name FROM contributor_profiles cp LEFT JOIN schools s ON s.id=cp.school_id ORDER BY cp.created_at DESC`).all(),
  db.prepare(`SELECT g.id,g.game_date,g.game_time,g.status,g.home_team_id,g.away_team_id,ht.team_name AS home_name,at.team_name AS away_name,sp.sport_name,sp.gender FROM games g LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN sports sp ON sp.id=g.sport_id WHERE g.game_date>=? AND g.game_date<=? ORDER BY g.game_date,g.game_time LIMIT 400`).bind(today,future).all(),
  db.prepare(`SELECT u.*,cp.display_name,cp.public_credit_name,g.game_date,ht.team_name AS home_name,at.team_name AS away_name,sp.sport_name,sp.gender FROM contributor_score_updates u LEFT JOIN contributor_profiles cp ON cp.id=u.contributor_id LEFT JOIN games g ON g.id=u.game_id LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN sports sp ON sp.id=g.sport_id WHERE u.publication_status='pending' ORDER BY u.created_at DESC LIMIT 100`).all(),
  db.prepare(`SELECT id,contributor_id,game_id,assignment_role,active,created_at FROM contributor_game_assignments WHERE active=1`).all(),
  db.prepare(`SELECT id,game_id,coverage_role,status,notes,claimed_by,claimed_at,created_at FROM contributor_coverage_requests WHERE status IN ('open','claimed') ORDER BY created_at DESC`).all()
 ])
 const accounts=(accountsResult.results||[]).map((a:any)=>({...a,stage:a.claim_required?'claim-required':a.profile_id?(a.profile_status||'pending'):(a.verified_at?'verified-incomplete':'unverified')}))
 const profiles=(profilesResult.results||[]).map((p:any)=>({...p,roles:parse(p.roles),school:p.school_join_id?{id:p.school_join_id,school_name:p.school_name}:null}))
 const games=(gamesResult.results||[]).map((g:any)=>({...g,home_team:g.home_name?{team_name:g.home_name}:null,away_team:g.away_name?{team_name:g.away_name}:null,sport:g.sport_name?{sport_name:g.sport_name,gender:g.gender}:null}))
 const pendingUpdates=(pendingResult.results||[]).map((u:any)=>({...u,contributor:{display_name:u.display_name,public_credit_name:u.public_credit_name},game:{game_date:u.game_date,home_team:u.home_name?{team_name:u.home_name}:null,away_team:u.away_name?{team_name:u.away_name}:null,sport:u.sport_name?{sport_name:u.sport_name,gender:u.gender}:null}}))
 return <div className="space-y-6"><CoverageBoard profiles={profiles} games={games} requests={coverageResult.results||[]} /><ContributorAdmin accounts={accounts} profiles={profiles} games={games} pendingUpdates={pendingUpdates} assignments={assignmentsResult.results||[]} /></div>
}
