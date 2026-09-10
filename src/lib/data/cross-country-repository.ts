export interface CrossCountryRepository {
  getMeetsByDate(date: string): Promise<any[]>
  getMeetDates(startDate: string, endDate: string): Promise<string[]>
  getTeamResultsForMeetIds(meetIds: string[]): Promise<any[]>
  getDualResultsForMeetIds(meetIds: string[]): Promise<any[]>
}
