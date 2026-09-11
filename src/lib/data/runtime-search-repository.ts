import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { SearchRepository } from './search-repository'
import { D1SearchRepository } from './d1-search-repository'

export function getSearchRepository(): SearchRepository {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1SearchRepository(db)
}
