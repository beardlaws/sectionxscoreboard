import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { TeamPhotoRepository } from './team-photo-repository'
import { D1TeamPhotoRepository } from './d1-team-photo-repository'

export function getTeamPhotoRepository(): TeamPhotoRepository {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1TeamPhotoRepository(db)
}
