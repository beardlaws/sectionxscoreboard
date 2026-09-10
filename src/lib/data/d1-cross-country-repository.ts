import type { CrossCountryRepository } from './cross-country-repository'

function placeholders(count: number) { return Array.from({ length: count }, () => '?').join(',') }

export class D1CrossCountryRepository implements CrossCountryRepository {
  constructor(private db: any) {}

  async getMeetsByDate(date: string) { const r=await this.db.prepare(`SELECT * FROM cross_country_meets WHERE meet_date=? ORDER BY meet_name ASC`).bind(date).all(); return r.results||[] }
  async getMeetsForSeason(seasonId: string) { const r=await this.db.prepare(`SELECT * FROM cross_country_meets WHERE season_id=? ORDER BY meet_date ASC,meet_name ASC`).bind(seasonId).all(); return r.results||[] }
  async getMeetDates(startDate: string,endDate: string) { const r=await this.db.prepare(`SELECT DISTINCT meet_date FROM cross_country_meets WHERE meet_date>=? AND meet_date<=? ORDER BY meet_date ASC`).bind(startDate,endDate).all(); return (r.results||[]).map((x:any)=>String(x.meet_date)) }

  async getTeamResultsForMeetIds(meetIds: string[]) {
    if(!meetIds.length)return []
    const r=await this.db.prepare(`SELECT r.*,s.id AS joined_sport_id,s.slug AS sport_slug,s.gender AS sport_gender,s.sport_name,t.id AS joined_team_id,t.team_name,t.slug AS team_slug,sc.id AS school_id,sc.school_name,sc.slug AS school_slug,sc.primary_color,sc.logo_url,sc.is_section_x AS school_is_section_x,eo.id AS joined_external_id,eo.name AS external_name,eo.slug AS external_slug FROM cross_country_team_results r LEFT JOIN sports s ON s.id=r.sport_id LEFT JOIN teams t ON t.id=r.team_id LEFT JOIN schools sc ON sc.id=t.school_id LEFT JOIN external_opponents eo ON eo.id=r.external_opponent_id WHERE r.meet_id IN (${placeholders(meetIds.length)}) ORDER BY r.finish_place ASC`).bind(...meetIds).all()
    return (r.results||[]).map((row:any)=>({id:row.id,meet_id:row.meet_id,sport_id:row.sport_id,team_id:row.team_id,external_opponent_id:row.external_opponent_id,team_score:row.team_score,finish_place:row.finish_place,is_section_x:Boolean(row.is_section_x),created_at:row.created_at,sport:row.joined_sport_id?{id:row.joined_sport_id,slug:row.sport_slug,gender:row.sport_gender,sport_name:row.sport_name}:null,team:row.joined_team_id?{id:row.joined_team_id,team_name:row.team_name,slug:row.team_slug,sport_id:row.sport_id,active:true,school:row.school_id?{id:row.school_id,school_name:row.school_name,slug:row.school_slug,primary_color:row.primary_color,logo_url:row.logo_url,is_section_x:Boolean(row.school_is_section_x)}:null}:null,external_opponent:row.joined_external_id?{id:row.joined_external_id,name:row.external_name,slug:row.external_slug}:null}))
  }

  async getTeamResultsForSport(sportId:string,meetIds?:string[]) { let sql='SELECT * FROM cross_country_team_results WHERE sport_id=?',binds:any[]=[sportId];if(meetIds?.length){sql+=` AND meet_id IN (${placeholders(meetIds.length)})`;binds.push(...meetIds)}sql+=' ORDER BY meet_id ASC,finish_place ASC';const r=await this.db.prepare(sql).bind(...binds).all();return r.results||[] }
  async getDualResultsForMeetIds(meetIds:string[]) { if(!meetIds.length)return [];const r=await this.db.prepare(`SELECT * FROM cross_country_dual_results WHERE meet_id IN (${placeholders(meetIds.length)}) ORDER BY created_at ASC`).bind(...meetIds).all();return r.results||[] }
  async getDualResultsForSport(sportId:string,meetIds?:string[]) { let sql='SELECT * FROM cross_country_dual_results WHERE sport_id=?',binds:any[]=[sportId];if(meetIds?.length){sql+=` AND meet_id IN (${placeholders(meetIds.length)})`;binds.push(...meetIds)}sql+=' ORDER BY created_at ASC';const r=await this.db.prepare(sql).bind(...binds).all();return r.results||[] }

  async getActiveTeamsForSportIds(sportIds:string[]) {
    if(!sportIds.length)return []
    const r=await this.db.prepare(`SELECT t.id,t.team_name,t.slug,t.sport_id,t.level,t.active,s.id AS school_id,s.school_name,s.slug AS school_slug,s.is_section_x FROM teams t LEFT JOIN schools s ON s.id=t.school_id WHERE t.sport_id IN (${placeholders(sportIds.length)}) AND t.active=1 ORDER BY s.school_name,t.team_name`).bind(...sportIds).all()
    return (r.results||[]).map((x:any)=>({id:x.id,team_name:x.team_name,slug:x.slug,sport_id:x.sport_id,level:x.level,active:Boolean(x.active),school:x.school_id?{id:x.school_id,school_name:x.school_name,slug:x.school_slug,is_section_x:Boolean(x.is_section_x)}:null}))
  }

  async getIndividualResultsForMeet(meetId:string,sportId?:string|null) {
    let sql=`SELECT r.*,a.display_name,a.slug AS athlete_slug,t.team_name,t.slug AS team_slug,s.school_name,s.slug AS school_slug,eo.name AS external_name FROM cross_country_individual_results r LEFT JOIN athletes a ON a.id=r.athlete_id LEFT JOIN teams t ON t.id=r.team_id LEFT JOIN schools s ON s.id=t.school_id LEFT JOIN external_opponents eo ON eo.id=r.external_opponent_id WHERE r.meet_id=?`,binds:any[]=[meetId]
    if(sportId){sql+=' AND r.sport_id=?';binds.push(sportId)}
    sql+=' ORDER BY r.sport_id,r.finish_place ASC'
    const r=await this.db.prepare(sql).bind(...binds).all()
    return (r.results||[]).map((x:any)=>({...x,scorer:Boolean(x.scorer),displacer:Boolean(x.displacer),athlete:x.athlete_id?{id:x.athlete_id,display_name:x.display_name,slug:x.athlete_slug}:null,team:x.team_id?{id:x.team_id,team_name:x.team_name,slug:x.team_slug,school:x.school_name?{school_name:x.school_name,slug:x.school_slug}:null}:null,external_opponent:x.external_opponent_id?{name:x.external_name}:null}))
  }
}
