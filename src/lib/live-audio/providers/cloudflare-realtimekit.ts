import type {
  CreateLiveAudioSessionInput,
  CreateParticipantInput,
  LiveAudioParticipantCredential,
  LiveAudioProvider,
  LiveAudioSession,
} from '../types'

type Config = {
  accountId: string
  appId: string
  apiToken: string
  publisherPreset: string
  listenerPreset: string
}

export class CloudflareRealtimeKitProvider implements LiveAudioProvider {
  readonly name = 'realtimekit'

  constructor(private readonly config: Config) {}

  private baseUrl() {
    return `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/realtime/kit/${this.config.appId}`
  }

  private async request(path: string, init: RequestInit) {
    const response = await fetch(`${this.baseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    })
    const payload: any = await response.json().catch(() => null)
    if (!response.ok || payload?.success === false) {
      const detail = payload?.errors?.[0]?.message || payload?.message || `RealtimeKit request failed (${response.status})`
      throw new Error(detail)
    }
    return payload?.result ?? payload?.data ?? payload
  }

  async createSession(input: CreateLiveAudioSessionInput): Promise<LiveAudioSession> {
    const result = await this.request('/meetings', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        status: 'ACTIVE',
        persist_chat: false,
        summarize_on_end: false,
        live_stream_on_start: false,
      }),
    })
    const id = String(result?.id || result?.meeting?.id || '')
    if (!id) throw new Error('RealtimeKit did not return a meeting id.')
    return { provider: this.name, providerSessionId: id }
  }

  async createParticipant(input: CreateParticipantInput): Promise<LiveAudioParticipantCredential> {
    const preset = input.role === 'publisher' ? this.config.publisherPreset : this.config.listenerPreset
    const result = await this.request(`/meetings/${input.providerSessionId}/participants`, {
      method: 'POST',
      body: JSON.stringify({
        name: input.displayName,
        custom_participant_id: input.subjectId,
        preset_name: preset,
      }),
    })
    const id = String(result?.id || result?.participant?.id || '')
    const token = String(result?.token || result?.auth_token || result?.participant?.token || '')
    if (!id || !token) throw new Error('RealtimeKit did not return participant credentials.')
    return { providerParticipantId: id, token }
  }

  async endSession(providerSessionId: string): Promise<void> {
    await this.request(`/meetings/${providerSessionId}/active-session/kick-all`, {
      method: 'POST',
      body: JSON.stringify({}),
    }).catch(() => null)

    await this.request(`/meetings/${providerSessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'INACTIVE' }),
    })
  }
}

export function createCloudflareRealtimeKitProviderFromEnv(env: Record<string, unknown>) {
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || '')
  const appId = String(env.REALTIMEKIT_APP_ID || '')
  const apiToken = String(env.REALTIMEKIT_API_TOKEN || '')
  const publisherPreset = String(env.REALTIMEKIT_PUBLISHER_PRESET || 'section-x-broadcaster')
  const listenerPreset = String(env.REALTIMEKIT_LISTENER_PRESET || 'section-x-listener')
  if (!accountId || !appId || !apiToken) throw new Error('RealtimeKit is not configured.')
  return new CloudflareRealtimeKitProvider({ accountId, appId, apiToken, publisherPreset, listenerPreset })
}
