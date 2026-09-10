export interface SportsRepository {
  getActiveSeason(): Promise<any | null>
  getSeasons(): Promise<any[]>
  getSports(): Promise<any[]>
  getSchools(): Promise<any[]>
  getGamesByDate(date: string): Promise<any[]>
  getGamesBetween(startExclusive: string, endInclusive: string, limit?: number): Promise<any[]>
  getRecentFinals(sinceDate: string, limit?: number): Promise<any[]>
  getFeaturedGame(date: string): Promise<any | null>
  getDatesWithGames(startDate: string, endDate: string, seasonId?: string | null): Promise<string[]>
}
