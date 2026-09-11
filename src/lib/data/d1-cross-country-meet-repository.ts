import type { CrossCountryMeetRepository } from './cross-country-meet-repository'

function sport(row:any){return row.sport_id?{id:row.sport_id,slug:row.sport_slug,gender:row.sport_gender,sport_name:row.sport_name}:null}
function team(row:any,prefix='team'){const id=row[`${prefix}_id`];if(!id)return null;return{id,team_name:row[`${prefix}_name`],slug:row[`${prefix}_slug`],school:row[`${prefix}_school_id`]?{id:row[`${prefix}_school_id`],school_name:row[`${prefix}_school_name`],slug:row[`${prefix}_school_slug`],primary_color:row[`${prefix}_school_primary_color`],logo_url:row[`${prefix}_school_logo_url`]}:null}}

export class D1CrossCountryMeetRepository implements CrossCountryMeetRepository {
  constructor(private db:any){}
  async getMeet(id:string){return await this.db.prepare('SELECT * FROM cross_country_meets WHERE id=? LIMIT 1').bind(id).first()||null}
  async getTeamResults(meetId:string){
    const r=await this.db.prepare(`SELECT x.*,sp.slug AS sport_slug,sp.gender AS sport_gender,sp.sport_name,t.team_name,t.slug AS team_slug,s.id AS team_school_id,s.school_name AS team_school_name,s.slug AS team_school_slug,s.primary_color AS team_school_primary_color,s.logo_url AS team_school_logo_url,e.name AS external_name,e.slug AS external_slug FROM cross_country_team_results x LEFT JOIN sports sp ON sp.id=x.sport_id LEFT JOIN teams t ON t.id=x.team_id LEFT JOIN schools s ON s.id=t.school_id LEFT JOIN external_opponents e ON e.id=x.external_opponent_id WHERE x.meet_id=? ORDER BY x.finish_place ASC`).bind(meetId).all()
    return (r.results||[]).map((x:any)=>({...x,is_section_x:Boolean(x.is_section_x),sport:sport(x),team:x.team_id?{id:x.team_id,team_name:x.team_name,slug:x.team_slug,school:x.team_school_id?{id:x.team_school_id,school_name:x.team_school_name,slug:x.team_school_slug,primary_color:x.team_school_primary_color,logo_url:x.team_school_logo_url}:null}:null,external_opponent:x.external_opponent_id?{id:x.external_opponent_id,name:x.external_name,slug:x.external_slug}:null}))
  }
  async getDualResults(meetId:string){
    const r=await this.db.prepare(`SELECT x.*,sp.slug AS sport_slug,sp.gender AS sport_gender,sp.sport_name,a.team_name AS team_a_name,a.slug AS team_a_slug,sa.id AS team_a_school_id,sa.school_name AS team_a_school_name,sa.slug AS team_a_school_slug,b.team_name AS team_b_name,b.slug AS team_b_slug,sb.id AS team_b_school_id,sb.school_name AS team_b_school_name,sb.slug AS team_b_school_slug FROM cross_country_dual_results x LEFT JOIN sports sp ON sp.id=x.sport_id LEFT JOIN teams a ON a.id=x.team_a_id LEFT JOIN schools sa ON sa.id=a.school_id LEFT JOIN teams b ON b.id=x.team_b_id LEFT JOIN schools sb ON sb.id=b.school_id WHERE x.meet_id=? ORDER BY x.created_at ASC`).bind(meetId).all()
    return (r.results||[]).map((x:any)=>({...x,sport:sport(x),team_a:team(x,'team_a'),team_b:team(x,'team_b')}))
  }
  async getIndividualResults(meetId:string){
    const r=await this.db.prepare(`SELECT x.*,sp.slug AS sport_slug,sp.gender AS sport_gender,sp.sport_name,a.display_name,a.slug AS athlete_slug,t.team_name,t.slug AS team_slug,s.id AS team_school_id,s.school_name AS team_school_name,s.slug AS team_school_slug,e.name AS external_name,e.slug AS external_slug FROM cross_country_individual_results x LEFT JOIN sports sp ON sp.id=x.sport_id LEFT JOIN athletes a ON a.id=x.athlete_id LEFT JOIN teams t ON t.id=x.team_id LEFT JOIN schools s ON s.id=t.school_id LEFT JOIN external_opponents e ON e.id=x.external_opponent_id WHERE x.meet_id=? ORDER BY x.finish_place ASC`).bind(meetId).all()
    return (r.results||[]).map((x:any)=>({...x,sport:sport(x),athlete:x.athlete_id?{id:x.athlete_id,display_name:x.display_name,slug:x.athlete_slug}:null,team:x.team_id?{id:x.team_id,team_name:x.team_name,slug:x.team_slug,school:x.team_school_id?{id:x.team_school_id,school_name:x.team_school_name,slug:x.team_school_slug}:null}:null,external_opponent:x.external_opponent_id?{id:x.external_opponent_id,name:x.external_name,slug:x.external_slug}:null}))
  }
}
