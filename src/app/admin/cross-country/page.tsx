import AdminLayout from '@/components/layout/AdminLayout'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import CrossCountryAdminClient from './CrossCountryAdminClient'

export const dynamic='force-dynamic'
async function all(db:any,sql:string,...values:any[]){const r=await db.prepare(sql).bind(...values).all();return r.results||[]}

export default async function CrossCountryAdminPage(){
  const {env}=getCloudflareContext(),db=(env as any).DB
  if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
  const [meets,resultRows,duals,teamRows]=await Promise.all([
    all(db,'SELECT * FROM cross_country_meets ORDER BY meet_date DESC'),
    all(db,`SELECT r.*,sp.id AS sport_join_id,sp.gender AS sport_gender,sp.slug AS sport_slug,t.id AS team_join_id,t.team_name,sc.id AS school_id,sc.school_name,sc.slug AS school_slug,e.id AS external_id,e.name AS external_name,e.slug AS external_slug FROM cross_country_team_results r LEFT JOIN sports sp ON sp.id=r.sport_id LEFT JOIN teams t ON t.id=r.team_id LEFT JOIN schools sc ON sc.id=t.school_id LEFT JOIN external_opponents e ON e.id=r.external_opponent_id ORDER BY r.finish_place ASC`),
    all(db,'SELECT * FROM cross_country_dual_results'),
    all(db,`SELECT t.id,t.team_name,sc.school_name FROM teams t LEFT JOIN schools sc ON sc.id=t.school_id`)
  ])
  const results=resultRows.map((r:any)=>({...r,sport:r.sport_join_id?{id:r.sport_join_id,gender:r.sport_gender,slug:r.sport_slug}:null,team:r.team_join_id?{id:r.team_join_id,team_name:r.team_name,school:r.school_id?{id:r.school_id,school_name:r.school_name,slug:r.school_slug}:null}:null,external_opponent:r.external_id?{id:r.external_id,name:r.external_name,slug:r.external_slug}:null}))
  const teams=teamRows.map((t:any)=>({...t,school:t.school_name?{school_name:t.school_name}:null}))
  const teamMap=new Map(teams.map((t:any)=>[t.id,t]))
  const rows=meets.map((m:any)=>({...m,
    results:results.filter((r:any)=>r.meet_id===m.id),
    duals:duals.filter((d:any)=>d.meet_id===m.id).map((d:any)=>({...d,team_a:teamMap.get(d.team_a_id),team_b:teamMap.get(d.team_b_id)}))
  }))
  return <AdminLayout><div className="p-4 md:p-6 max-w-5xl mx-auto"><div className="mb-6"><div className="text-xs font-black uppercase tracking-[.2em] text-lime-300">Section X Cross Country</div><h1 className="text-3xl font-black text-white mt-1">Meet Manager</h1><p className="text-sm mt-1" style={{color:'var(--text-muted)'}}>Create meets and publish boys and girls team results without forcing XC into two-team game scoring.</p></div><CrossCountryAdminClient meets={rows}/></div></AdminLayout>
}
