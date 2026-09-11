type SendEmailInput = {
  to: string
  subject: string
  html: string
}

type SendEmailResult = {
  configured: boolean
  provider?: 'resend' | 'brevo'
  id?: string | null
  error?: string
}

type EmailRuntimeEnv = {
  RESEND_API_KEY?: string
  BREVO_API_KEY?: string
  FAN_ALERTS_FROM?: string
  FAN_ALERT_FROM?: string
}

function value(env: EmailRuntimeEnv | undefined, key: keyof EmailRuntimeEnv) {
  const direct = env?.[key]
  if (direct) return direct
  return typeof process !== 'undefined' ? process.env[String(key)] : undefined
}

const fromAddress = (env?: EmailRuntimeEnv) =>
  value(env, 'FAN_ALERTS_FROM') ||
  value(env, 'FAN_ALERT_FROM') ||
  'Section X Scoreboard <alerts@updates.sectionxscoreboard.com>'

const retryable = (status: number) => status === 429 || status >= 500
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function fanEmailConfigured(env?: EmailRuntimeEnv) {
  return Boolean(value(env, 'RESEND_API_KEY') || value(env, 'BREVO_API_KEY'))
}

async function sendResend(input: SendEmailInput, env?: EmailRuntimeEnv): Promise<SendEmailResult> {
  const apiKey = value(env, 'RESEND_API_KEY')
  if (!apiKey) return { configured: false, error: 'Resend is not configured.' }
  const maxAttempts = 3
  let lastError = 'Unknown Resend error.'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress(env),
          to: [input.to],
          subject: input.subject,
          html: input.html,
        }),
      })

      const body: any = await response.json().catch(() => ({}))
      if (response.ok) return { configured: true, provider: 'resend', id: body?.id || null }

      lastError = body?.message || `Resend HTTP ${response.status}`
      if (!retryable(response.status) || attempt === maxAttempts) break
      await sleep(400 * attempt)
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      if (attempt === maxAttempts) break
      await sleep(400 * attempt)
    }
  }

  return { configured: true, provider: 'resend', error: lastError }
}

async function sendBrevo(input: SendEmailInput, env?: EmailRuntimeEnv): Promise<SendEmailResult> {
  const apiKey = value(env, 'BREVO_API_KEY')
  if (!apiKey) return { configured: false, error: 'Brevo is not configured.' }
  const from = fromAddress(env)
  const match = from.match(/^(.*?)\s*<([^>]+)>$/)
  const sender = match
    ? { name: match[1].trim(), email: match[2].trim() }
    : { name: 'Section X Scoreboard', email: from }

  const maxAttempts = 3
  let lastError = 'Unknown Brevo error.'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender,
          to: [{ email: input.to }],
          subject: input.subject,
          htmlContent: input.html,
        }),
      })

      const body: any = await response.json().catch(() => ({}))
      if (response.ok) return { configured: true, provider: 'brevo', id: body?.messageId || null }

      lastError = body?.message || `Brevo HTTP ${response.status}`
      if (!retryable(response.status) || attempt === maxAttempts) break
      await sleep(400 * attempt)
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      if (attempt === maxAttempts) break
      await sleep(400 * attempt)
    }
  }

  return { configured: true, provider: 'brevo', error: lastError }
}

export async function sendFanEmail(input: SendEmailInput, env?: EmailRuntimeEnv): Promise<SendEmailResult> {
  if (value(env, 'RESEND_API_KEY')) return sendResend(input, env)
  if (value(env, 'BREVO_API_KEY')) return sendBrevo(input, env)
  return { configured: false, error: 'No fan email provider configured.' }
}
