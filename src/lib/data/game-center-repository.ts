export interface GameCenterRepository {
  getGame(id: string): Promise<any | null>
  getGamePhotos(gameId: string): Promise<any[]>
  getPeriodScores(gameId: string): Promise<any[]>
  getTeamStats(gameId: string): Promise<any[]>
  getAthleteStats(gameId: string): Promise<any[]>
  getTeamSeasons(sportId: string, seasonId: string): Promise<any[]>
  getStandingsGames(sportId: string, seasonId: string): Promise<any[]>
  getGamesOnDate(date: string, excludeId?: string | null, limit?: number): Promise<any[]>
  getTeamSchedule(teamId: string, sportId: string, seasonId: string): Promise<any[]>
  getPriorMeetings(teamAId: string, teamBId: string, sportId: string, excludeId?: string | null, limit?: number): Promise<any[]>
}
