const ARBITER_TOKEN_URL = process.env.ARBITER_TOKEN_URL || 'https://token.arbitersports.com/connect/token'
const ARBITER_API_BASE_URL = process.env.ARBITER_API_BASE_URL || 'https://partner.arbitersports.com'
const ARBITER_SCOPE = process.env.ARBITER_SCOPE || 'Scheduling'

type CachedToken = {
  accessToken: string
  expiresAt: number
}

let tokenCache: CachedToken | null = null

type QueryPrimitive = string | number | boolean
export type ArbiterQuery = Record<
  string,
  QueryPrimitive | QueryPrimitive[] | null | undefined
>

export type ArbiterRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD'
  query?: ArbiterQuery
  body?: unknown
  noData404?: boolean
}

export class ArbiterApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ArbiterApiError'
    this.status = status
    this.details = details
  }
}

export function getArbiterConfigStatus() {
  return {
    configured: Boolean(process.env.ARBITER_CLIENT_ID && process.env.ARBITER_CLIENT_SECRET),
    hasClientId: Boolean(process.env.ARBITER_CLIENT_ID),
    hasClientSecret: Boolean(process.env.ARBITER_CLIENT_SECRET),
    tokenUrl: ARBITER_TOKEN_URL,
    apiBaseUrl: ARBITER_API_BASE_URL,
    scope: ARBITER_SCOPE,
  }
}

async function getAccessToken(): Promise<string> {
  const now = Date.now()

  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken
  }

  const clientId = process.env.ARBITER_CLIENT_ID
  const clientSecret = process.env.ARBITER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new ArbiterApiError(
      'Arbiter Partner API credentials are not configured on the server.',
      500
    )
  }

  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: ARBITER_SCOPE,
  })

  let response = await fetch(ARBITER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form.toString(),
    cache: 'no-store',
  })

  if (!response.ok) {
    const fallback = new URLSearchParams({
      clientid: clientId,
      clientsecret: clientSecret,
      granttype: 'clientcredentials',
      scope: ARBITER_SCOPE,
    })

    response = await fetch(ARBITER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: fallback.toString(),
      cache: 'no-store',
    })
  }

  const raw = await response.text()
  let payload: any = null

  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = raw
  }

  if (!response.ok) {
    throw new ArbiterApiError(
      `Arbiter token request failed with HTTP ${response.status}.`,
      response.status,
      payload
    )
  }

  const accessToken = payload?.access_token || payload?.accesstoken
  const expiresIn = Number(payload?.expires_in || payload?.expiresin || 3600)

  if (!accessToken) {
    throw new ArbiterApiError('Arbiter token response did not include an access token.', 502)
  }

  tokenCache = {
    accessToken,
    expiresAt: now + Math.max(60, expiresIn) * 1000,
  }

  return accessToken
}

export async function arbiterRequest<T = unknown>(
  path: string,
  options: ArbiterRequestOptions = {}
): Promise<T | null> {
  const token = await getAccessToken()
  const url = new URL(path, ARBITER_API_BASE_URL)

  for (const [key, value] of Object.entries(options.query || {})) {
    if (value === null || value === undefined || value === '') continue

    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item))
    } else {
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }

  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  })

  if (response.status === 404 && options.noData404) return null

  const raw = options.method === 'HEAD' ? '' : await response.text()
  let payload: any = null

  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = raw
  }

  if (!response.ok) {
    throw new ArbiterApiError(
      `Arbiter API request failed with HTTP ${response.status}.`,
      response.status,
      payload
    )
  }

  return payload as T
}

export const arbiterApi = {
  identity: () => arbiterRequest('/api/Identity'),
  groups: (groupId?: number | string) =>
    arbiterRequest('/api/Group', { query: groupId ? { GroupID: groupId } : undefined }),
  schools: (query: ArbiterQuery) =>
    arbiterRequest('/api/School/GetAllSchools', { query, noData404: true }),
  schoolPartnerIds: (schoolIds: number[]) =>
    arbiterRequest('/api/School/GetPartnerIdsForSchools', {
      query: { SchoolIds: schoolIds },
      noData404: true,
    }),
  sports: () => arbiterRequest('/api/Sport/GetGenericSports'),
  levels: () => arbiterRequest('/api/Level/GetLevels'),
  teams: (query: ArbiterQuery) =>
    arbiterRequest('/api/Team/GetTeams', { query, noData404: true }),
  teamWithRoster: (teamId: number | string, schoolId?: number | string) =>
    arbiterRequest('/api/Team/GetTeamWithRosters', {
      query: { teamId, schoolId },
      noData404: true,
    }),
  games: (query: ArbiterQuery) =>
    arbiterRequest('/api/Game/GetGames', { query, noData404: true }),
  deletedGames: (fromDate: string, toDate?: string) =>
    arbiterRequest('/api/Game/DeletedGames', {
      query: { fromDate, toDate },
      noData404: true,
    }),
}
