export interface PublicContentRepository {
  getHomepageSponsor(today: string): Promise<any | null>
  getScoresSponsor(today: string): Promise<any | null>
  getSportSponsor(sportId: string, today: string): Promise<any | null>
  getSchoolSponsor(schoolId: string, today: string): Promise<any | null>
  getFeaturedSpotlight(): Promise<any | null>
  getSpotlights(limit?: number): Promise<any[]>
  getSpotlightById(id: string): Promise<any | null>
  getFeaturedAthlete(): Promise<any | null>
  getHomepagePhotos(limit?: number): Promise<any[]>
  getPhotos(limit?: number): Promise<any[]>
  getLatestWeeklyRecap(): Promise<any | null>
  getTeamRoster(teamId: string, seasonId: string): Promise<any[]>
  getTeamCoaches(teamId: string, seasonId: string): Promise<any[]>
  getAthleteBySlug(slug: string): Promise<any | null>
  getAthleteMemberships(athleteId: string): Promise<any[]>
  getAthletePhotos(athleteId: string): Promise<any[]>
  getAthleteStats(athleteId: string): Promise<any[]>
}
