const SESSION_VERSION = 'v1'
export const ADMIN_SESSION_COOKIE = 'sectionx_admin_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7

function base64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function createAdminSession(secret: string) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + ADMIN_SESSION_MAX_AGE
  const nonceBytes = new Uint8Array(16)
  crypto.getRandomValues(nonceBytes)
  const nonce = base64Url(nonceBytes)
  const payload = `${SESSION_VERSION}.${issuedAt}.${expiresAt}.${nonce}`
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(secret),
    new TextEncoder().encode(payload)
  )

  return `${payload}.${base64Url(new Uint8Array(signature))}`
}

export async function verifyAdminSession(token: string | undefined | null, secret: string | undefined | null) {
  if (!token || !secret) return false

  const parts = token.split('.')
  if (parts.length !== 5) return false

  const [version, issuedAtRaw, expiresAtRaw, nonce, signatureRaw] = parts
  if (version !== SESSION_VERSION || !nonce) return false

  const issuedAt = Number(issuedAtRaw)
  const expiresAt = Number(expiresAtRaw)
  const now = Math.floor(Date.now() / 1000)

  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return false
  if (issuedAt > now + 60 || expiresAt <= now || expiresAt - issuedAt > ADMIN_SESSION_MAX_AGE + 60) return false

  const payload = `${version}.${issuedAtRaw}.${expiresAtRaw}.${nonce}`

  try {
    return await crypto.subtle.verify(
      'HMAC',
      await signingKey(secret),
      decodeBase64Url(signatureRaw),
      new TextEncoder().encode(payload)
    )
  } catch {
    return false
  }
}
