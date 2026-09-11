import type { TeamPhotoRepository } from './team-photo-repository'

export class D1TeamPhotoRepository implements TeamPhotoRepository {
  constructor(private db: any) {}

  async getApprovedPhotosForGameIds(gameIds: string[]) {
    if (!gameIds.length) return []
    const placeholders = gameIds.map(()=>'?').join(',')
    const result = await this.db.prepare(`
      SELECT id,game_id,photo_url,caption,photographer_credit_name,created_at
      FROM photos
      WHERE approved=1 AND game_id IN (${placeholders})
      ORDER BY created_at DESC
    `).bind(...gameIds).all()
    return result.results || []
  }
}
