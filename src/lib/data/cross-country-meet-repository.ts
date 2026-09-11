export interface CrossCountryMeetRepository {
  getMeet(id:string): Promise<any|null>
  getTeamResults(meetId:string): Promise<any[]>
  getDualResults(meetId:string): Promise<any[]>
  getIndividualResults(meetId:string): Promise<any[]>
}
