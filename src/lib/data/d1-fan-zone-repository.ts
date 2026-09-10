import type { FanZoneRepository } from './fan-zone-repository'

export class D1FanZoneRepository implements FanZoneRepository {
  constructor(private db:any) {}

  async getBallotTotal(limit=30) {
    const r=await this.db.prepare(`SELECT ballot_count FROM fan_power_rank_snapshots WHERE published=1 ORDER BY week_start DESC LIMIT ?`).bind(limit).all()
    return (r.results||[]).reduce((sum:number,x:any)=>sum+Number(x.ballot_count||0),0)
  }

  async getFeaturedPlays(limit=100) {
    const r=await this.db.prepare(`SELECT n.id,n.athlete_name,n.play_description,n.created_at,n.status,s.school_name,sp.sport_name,sp.gender FROM fan_top_play_nominations n LEFT JOIN schools s ON s.id=n.school_id LEFT JOIN sports sp ON sp.id=n.sport_id WHERE n.status IN ('approved','featured') ORDER BY n.created_at DESC LIMIT ?`).bind(limit).all()
    return (r.results||[]).map((x:any)=>({...x,school:x.school_name?{school_name:x.school_name}:null,sport:x.sport_name?{sport_name:x.sport_name,gender:x.gender}:null}))
  }

  async getSchoolVotes(weekStart:string) {
    const r=await this.db.prepare(`SELECT school_id,votes FROM fan_school_support_snapshots WHERE week_start=? AND published=1 ORDER BY votes DESC`).bind(weekStart).all()
    return r.results||[]
  }

  async getTeamsForSports(seasonId:string,sportIds:string[]) {
    if(!sportIds.length)return []
    const placeholders=sportIds.map(()=>'?').join(',')
    const r=await this.db.prepare(`SELECT ts.class,ts.division,ts.active_for_season,t.id,t.sport_id,t.team_name,t.level,t.active,s.school_name FROM team_seasons ts JOIN teams t ON t.id=ts.team_id LEFT JOIN schools s ON s.id=t.school_id WHERE ts.season_id=? AND ts.active_for_season != 0 AND t.sport_id IN (${placeholders})`).bind(seasonId,...sportIds).all()
    return (r.results||[]).map((x:any)=>({id:x.id,sport_id:x.sport_id,name:x.team_name,school:x.school_name||x.team_name,className:x.class||'',division:x.division||''}))
  }
}
