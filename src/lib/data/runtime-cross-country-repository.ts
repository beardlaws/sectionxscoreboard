import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { CrossCountryRepository } from './cross-country-repository'
import { D1CrossCountryRepository } from './d1-cross-country-repository'

export function getCrossCountryRepository(): CrossCountryRepository {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1CrossCountryRepository(db)
}
