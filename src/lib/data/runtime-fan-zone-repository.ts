import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { FanZoneRepository } from './fan-zone-repository'
import { D1FanZoneRepository } from './d1-fan-zone-repository'

export function getFanZoneRepository(): FanZoneRepository {
  const { env } = getCloudflareContext()
  const db=(env as any).DB
  if(!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1FanZoneRepository(db)
}
