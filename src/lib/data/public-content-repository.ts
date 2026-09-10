export interface PublicContentRepository {
  getHomepageSponsor(today: string): Promise<any | null>
  getScoresSponsor(today: string): Promise<any | null>
  getSportSponsor(sportId: string, today: string): Promise<any | null>
  getSchoolSponsor(schoolId: string, today: string): Promise<any | null>
  getFeaturedSpotlight(): Promise<any | null>
  getSpotlights(limit?: number): Promise<any[]>
  getFeaturedAthlete(): Promise<any | null>
  getHomepagePhotos(limit?: number): Promise<any[]>
  getLatestWeeklyRecap(): Promise<any | null>
  getTeamRoster(teamId: string, seasonId: string): Promise<any[]>
  getTeamCoaches(teamId: string, seasonId: string): Promise<any[]>
}
