export type SearchResults = {
  schools: any[]
  teams: any[]
  athletes: any[]
}

export interface SearchRepository {
  search(query: string): Promise<SearchResults>
}
