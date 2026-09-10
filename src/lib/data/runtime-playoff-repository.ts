import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { PlayoffRepository } from './playoff-repository'
import { D1PlayoffRepository } from './d1-playoff-repository'

export function getPlayoffRepository(): PlayoffRepository {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1PlayoffRepository(db)
}
