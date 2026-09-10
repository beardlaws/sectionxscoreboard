export interface FanZoneRepository {
  getBallotTotal(limit?: number): Promise<number>
  getFeaturedPlays(limit?: number): Promise<any[]>
  getSchoolVotes(weekStart: string): Promise<any[]>
  getTeamsForSports(seasonId: string, sportIds: string[]): Promise<any[]>
}
