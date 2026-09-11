import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { CrossCountryMeetRepository } from './cross-country-meet-repository'
import { D1CrossCountryMeetRepository } from './d1-cross-country-meet-repository'

export function getCrossCountryMeetRepository():CrossCountryMeetRepository{
  const {env}=getCloudflareContext()
  const db=(env as any).DB
  if(!db)throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1CrossCountryMeetRepository(db)
}
