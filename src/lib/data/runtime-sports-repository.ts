import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { SportsRepository } from './sports-repository'
import { D1SportsRepository } from './d1-sports-repository'

export function getSportsRepository(): SportsRepository {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1SportsRepository(db)
}
