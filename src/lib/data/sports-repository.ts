export interface SportsRepository {
  getActiveSeason(): Promise<any | null>
  getSeasons(): Promise<any[]>
  getSports(): Promise<any[]>
  getSportBySlug(slug: string): Promise<any | null>
  getSchools(): Promise<any[]>
  getSchoolBySlug(slug: string): Promise<any | null>
  getTeamsForSchool(schoolId: string, seasonId?: string | null): Promise<any[]>
  getTeamBySlug(slug: string): Promise<any | null>
  getTeamSeason(teamId: string, seasonId: string): Promise<any | null>
  getTeamSeasonsForSport(sportId: string, seasonId: string): Promise<any[]>
  getGamesByDate(date: string): Promise<any[]>
  getGamesBetween(startExclusive: string, endInclusive: string, limit?: number): Promise<any[]>
  getGamesForSport(sportId: string, seasonId: string, startDate?: string | null, endDate?: string | null): Promise<any[]>
  getFinalGamesForSport(sportId: string, seasonId: string): Promise<any[]>
  getGamesForTeam(teamId: string, seasonId?: string | null): Promise<any[]>
  getRecentFinals(sinceDate: string, limit?: number): Promise<any[]>
  getFeaturedGame(date: string): Promise<any | null>
  getDatesWithGames(startDate: string, endDate: string, seasonId?: string | null): Promise<string[]>
}
