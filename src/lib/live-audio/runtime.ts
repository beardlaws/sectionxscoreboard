import { getCloudflareContext } from '@opennextjs/cloudflare'
import { D1BroadcastRepository } from './d1-repository'
import { createCloudflareRealtimeKitProviderFromEnv } from './providers/cloudflare-realtimekit'

export function getLiveAudioRuntime() {
  const { env } = getCloudflareContext()
  const runtimeEnv = env as unknown as Record<string, unknown>
  const db = (runtimeEnv as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return {
    env: runtimeEnv,
    repository: new D1BroadcastRepository(db),
    provider: createCloudflareRealtimeKitProviderFromEnv(runtimeEnv),
  }
}
