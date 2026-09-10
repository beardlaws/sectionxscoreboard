import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { GameCenterRepository } from './game-center-repository'
import { D1GameCenterRepository } from './d1-game-center-repository'

export function getGameCenterRepository(): GameCenterRepository {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1GameCenterRepository(db)
}
