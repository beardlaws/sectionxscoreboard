import type { SearchRepository, SearchResults } from './search-repository'

export class D1SearchRepository implements SearchRepository {
  constructor(private db: any) {}

  async search(query: string): Promise<SearchResults> {
    const pattern = `%${query}%`
    const [schoolsResult, teamsResult, athletesResult] = await Promise.all([
      this.db.prepare(`
        SELECT id, school_name, mascot, slug, city
        FROM schools
        WHERE active = 1 AND (school_name LIKE ? COLLATE NOCASE OR mascot LIKE ? COLLATE NOCASE)
        ORDER BY school_name ASC
        LIMIT 12
      `).bind(pattern, pattern).all(),
      this.db.prepare(`
        SELECT t.id, t.team_name, t.slug,
               sc.school_name, sc.slug AS school_slug,
               sp.sport_name, sp.gender
        FROM teams t
        LEFT JOIN schools sc ON sc.id = t.school_id
        LEFT JOIN sports sp ON sp.id = t.sport_id
        WHERE t.active = 1 AND t.team_name LIKE ? COLLATE NOCASE
        ORDER BY t.team_name ASC
        LIMIT 18
      `).bind(pattern).all(),
      this.db.prepare(`
        SELECT a.id, a.display_name, a.slug,
               sc.school_name, sc.slug AS school_slug
        FROM athletes a
        LEFT JOIN schools sc ON sc.id = a.school_id
        WHERE a.active = 1 AND a.display_name LIKE ? COLLATE NOCASE
        ORDER BY a.display_name ASC
        LIMIT 18
      `).bind(pattern).all(),
    ])

    return {
      schools: schoolsResult.results || [],
      teams: (teamsResult.results || []).map((row: any) => ({
        id: row.id,
        team_name: row.team_name,
        slug: row.slug,
        school: row.school_name ? { school_name: row.school_name, slug: row.school_slug } : null,
        sport: row.sport_name ? { sport_name: row.sport_name, gender: row.gender } : null,
      })),
      athletes: (athletesResult.results || []).map((row: any) => ({
        id: row.id,
        display_name: row.display_name,
        slug: row.slug,
        school: row.school_name ? { school_name: row.school_name, slug: row.school_slug } : null,
      })),
    }
  }
}
