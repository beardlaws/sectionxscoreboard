import AdminLayout from '@/components/layout/AdminLayout'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import FanZoneAdminClient from './FanZoneAdminClient'

export const dynamic='force-dynamic'
function parseJson(v:any,fallback:any){if(v==null)return fallback;if(typeof v!=='string')return v;try{return JSON.parse(v)}catch{return fallback}}
async function all(db:any,sql:string,...values:any[]){const r=await db.prepare(sql).bind(...values).all();return r.results||[]}

export default async function FanZoneAdminPage(){
 const {env}=getCloudflareContext(),db=(env as any).DB
 if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
 const [playRows,snapshotRows,ballotRows,staffRows,teamSeasonRows]=await Promise.all([
  all(db,`SELECT p.*,sc.school_name,sp.sport_name,sp.gender FROM fan_top_play_nominations p LEFT JOIN schools sc ON sc.id=p.school_id LEFT JOIN sports sp ON sp.id=p.sport_id ORDER BY p.created_at DESC LIMIT 100`),
  all(db,`SELECT s.*,sp.sport_name,sp.gender FROM fan_power_rank_snapshots s LEFT JOIN sports sp ON sp.id=s.sport_id ORDER BY s.week_start DESC LIMIT 50`),
  all(db,`SELECT b.week_start,b.sport_id,b.group_type,b.group_value,b.rankings,b.updated_at,sp.sport_name,sp.gender FROM fan_power_rank_ballots b LEFT JOIN sports sp ON sp.id=b.sport_id ORDER BY b.updated_at DESC LIMIT 500`),
  all(db,`SELECT * FROM staff_power_rank_snapshots ORDER BY week_start DESC LIMIT 100`),
  all(db,`SELECT ts.class,ts.division,ts.active_for_season,t.id AS team_id,t.sport_id,t.team_name,sc.school_name FROM team_seasons ts JOIN teams t ON t.id=ts.team_id LEFT JOIN schools sc ON sc.id=t.school_id WHERE COALESCE(ts.active_for_season,1)<>0`)
 ])
 const plays=playRows.map((p:any)=>({...p,school:p.school_name?{school_name:p.school_name}:null,sport:p.sport_name||p.gender?{sport_name:p.sport_name,gender:p.gender}:null}))
 const snapshots=snapshotRows.map((s:any)=>({...s,results:parseJson(s.results,[]),sport:s.sport_name||s.gender?{sport_name:s.sport_name,gender:s.gender}:null}))
 const ballots=ballotRows.map((b:any)=>({...b,rankings:parseJson(b.rankings,[]),sport:b.sport_name||b.gender?{sport_name:b.sport_name,gender:b.gender}:null}))
 const staff=staffRows.map((s:any)=>({...s,rankings:parseJson(s.rankings,[])}))
 const teamSeasons=teamSeasonRows.map((x:any)=>({class:x.class,division:x.division,active_for_season:Boolean(x.active_for_season),team:{id:x.team_id,sport_id:x.sport_id,team_name:x.team_name,school:x.school_name?{school_name:x.school_name}:null}}))
 return <AdminLayout><div className="p-4 max-w-6xl"><h1 className="text-2xl font-black text-white">Fan Zone Control Room</h1><p className="text-sm text-slate-500 mt-1 mb-5">Review Top 5 Play nominations and watch fan power-ranking ballots build.</p><FanZoneAdminClient plays={plays} snapshots={snapshots} ballots={ballots} staff={staff} teamSeasons={teamSeasons}/></div></AdminLayout>
}
