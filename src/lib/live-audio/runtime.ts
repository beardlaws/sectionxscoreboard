import { getCloudflareContext } from '@opennextjs/cloudflare'
import { D1BroadcastRepository } from './d1-repository'
import { createCloudflareRealtimeKitProviderFromEnv } from './providers/cloudflare-realtimekit'
import { LiveAudioService } from './service'

function runtimeEnv() {
  const { env } = getCloudflareContext()
  return env as unknown as Record<string, unknown>
}

export function getBroadcastRepository() {
  const env = runtimeEnv()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return new D1BroadcastRepository(db)
}

export function getLiveAudioService() {
  const env = runtimeEnv()
  return new LiveAudioService(
    getBroadcastRepository(),
    createCloudflareRealtimeKitProviderFromEnv(env),
  )
}
