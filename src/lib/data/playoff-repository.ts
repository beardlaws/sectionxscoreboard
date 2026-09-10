export interface PlayoffRepository {
  getTournamentsForSeason(seasonId: string): Promise<any[]>
  getTournamentById(id: string): Promise<any | null>
  getGamesForTournament(id: string): Promise<any[]>
  getAllGames(): Promise<any[]>
}
