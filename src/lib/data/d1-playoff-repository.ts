import type { PlayoffRepository } from './playoff-repository'

export class D1PlayoffRepository implements PlayoffRepository {
  constructor(private db:any) {}

  async getTournamentsForSeason(seasonId:string) {
    const result = await this.db.prepare(`
      SELECT pt.*, s.sport_name, s.gender, se.name AS season_name
      FROM playoff_tournaments pt
      LEFT JOIN sports s ON s.id = pt.sport_id
      LEFT JOIN seasons se ON se.id = pt.season_id
      WHERE pt.season_id = ?
      ORDER BY pt.class ASC, pt.name ASC
    `).bind(seasonId).all()
    return (result.results || []).map((row:any)=>({
      ...row,
      sport: row.sport_id ? { id:row.sport_id, sport_name:row.sport_name, gender:row.gender } : null,
      season: row.season_id ? { id:row.season_id, name:row.season_name } : null,
    }))
  }

  async getTournamentById(id:string) {
    const row = await this.db.prepare(`
      SELECT pt.*, s.sport_name, s.gender, se.name AS season_name
      FROM playoff_tournaments pt
      LEFT JOIN sports s ON s.id = pt.sport_id
      LEFT JOIN seasons se ON se.id = pt.season_id
      WHERE pt.id = ? LIMIT 1
    `).bind(id).first()
    if (!row) return null
    return { ...row, sport: row.sport_id ? { id:row.sport_id, sport_name:row.sport_name, gender:row.gender } : null, season: row.season_id ? { id:row.season_id, name:row.season_name } : null }
  }

  async getGamesForTournament(id:string) {
    const result = await this.db.prepare('SELECT * FROM playoff_games WHERE tournament_id = ? ORDER BY round ASC, position ASC').bind(id).all()
    return result.results || []
  }

  async getAllGames() {
    const result = await this.db.prepare('SELECT * FROM playoff_games ORDER BY created_at ASC').all()
    return result.results || []
  }
}
