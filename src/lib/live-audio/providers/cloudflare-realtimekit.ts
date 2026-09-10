import type {
  CreateLiveAudioSessionInput,
  CreateParticipantInput,
  LiveAudioParticipantCredential,
  LiveAudioProvider,
  LiveAudioSession,
} from '@/lib/live-audio/types'

type RealtimeKitConfig = {
  accountId: string
  appId: string
  apiToken: string
  publisherPreset: string
  listenerPreset: string
}

type ApiEnvelope<T> = {
  success?: boolean
  data?: T
  errors?: Array<{ code?: number; message?: string }>
  error?: { code?: number; message?: string }
}

export class CloudflareRealtimeKitProvider implements LiveAudioProvider {
  readonly name = 'realtimekit'

  constructor(private readonly config: RealtimeKitConfig) {}

  private get baseUrl() {
    const { accountId, appId } = this.config
    return `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}`
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })

    const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>
    if (!response.ok || body.success === false || !body.data) {
      const message =
        body.error?.message ||
        body.errors?.map((error) => error.message).filter(Boolean).join('; ') ||
        `RealtimeKit request failed with HTTP ${response.status}`
      throw new Error(message)
    }

    return body.data
  }

  async createSession(input: CreateLiveAudioSessionInput): Promise<LiveAudioSession> {
    const data = await this.request<{ id: string }>('/meetings', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        status: 'ACTIVE',
        session_keep_alive_time_in_secs: 120,
      }),
    })

    return {
      provider: this.name,
      providerSessionId: data.id,
    }
  }

  async createParticipant(input: CreateParticipantInput): Promise<LiveAudioParticipantCredential> {
    const presetName = input.role === 'publisher'
      ? this.config.publisherPreset
      : this.config.listenerPreset

    const data = await this.request<{ id: string; token: string }>(
      `/meetings/${input.providerSessionId}/participants`,
      {
        method: 'POST',
        body: JSON.stringify({
          custom_participant_id: input.subjectId,
          name: input.displayName,
          preset_name: presetName,
        }),
      },
    )

    return {
      providerParticipantId: data.id,
      token: data.token,
    }
  }

  async endSession(providerSessionId: string): Promise<void> {
    // End the active session, then make the meeting inactive so an old token
    // cannot silently restart a finished broadcast.
    await fetch(`${this.baseUrl}/meetings/${providerSessionId}/active-session/kick-all`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json',
      },
    }).catch(() => undefined)

    await this.request<{ id: string }>(`/meetings/${providerSessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'INACTIVE' }),
    })
  }
}

export function createCloudflareRealtimeKitProviderFromEnv(): CloudflareRealtimeKitProvider {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const appId = process.env.REALTIMEKIT_APP_ID
  const apiToken = process.env.REALTIMEKIT_API_TOKEN
  const publisherPreset = process.env.REALTIMEKIT_PUBLISHER_PRESET || 'section-x-broadcaster'
  const listenerPreset = process.env.REALTIMEKIT_LISTENER_PRESET || 'section-x-listener'

  if (!accountId || !appId || !apiToken) {
    throw new Error('RealtimeKit is not configured. Missing Cloudflare account, app, or API token.')
  }

  return new CloudflareRealtimeKitProvider({
    accountId,
    appId,
    apiToken,
    publisherPreset,
    listenerPreset,
  })
}
