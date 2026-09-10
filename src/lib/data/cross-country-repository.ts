export interface CrossCountryRepository {
  getMeetsByDate(date: string): Promise<any[]>
  getMeetsForSeason(seasonId: string): Promise<any[]>
  getMeetDates(startDate: string, endDate: string): Promise<string[]>
  getTeamResultsForMeetIds(meetIds: string[]): Promise<any[]>
  getTeamResultsForSport(sportId: string, meetIds?: string[]): Promise<any[]>
  getDualResultsForMeetIds(meetIds: string[]): Promise<any[]>
  getDualResultsForSport(sportId: string, meetIds?: string[]): Promise<any[]>
  getActiveTeamsForSportIds(sportIds: string[]): Promise<any[]>
  getIndividualResultsForMeet(meetId: string, sportId?: string | null): Promise<any[]>
}
