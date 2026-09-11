import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { NotificationHealthRepository } from './notification-health-repository'
import { D1NotificationHealthRepository } from './d1-notification-health-repository'

export function getNotificationHealthRepository(): NotificationHealthRepository {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1NotificationHealthRepository(db)
}
