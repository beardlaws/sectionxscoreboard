import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { PublicContentRepository } from './public-content-repository'
import { D1PublicContentRepository } from './d1-public-content-repository'

export function getPublicContentRepository(): PublicContentRepository {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1PublicContentRepository(db)
}
