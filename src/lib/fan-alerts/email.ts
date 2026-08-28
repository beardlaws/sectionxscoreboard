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

const fromAddress = () =>
  process.env.FAN_ALERTS_FROM ||
  process.env.FAN_ALERT_FROM ||
  'Section X Scoreboard <alerts@updates.sectionxscoreboard.com>'

const retryable = (status: number) => status === 429 || status >= 500
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function fanEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY)
}

async function sendResend(input: SendEmailInput): Promise<SendEmailResult> {
  const maxAttempts = 3
  let lastError = 'Unknown Resend error.'

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [input.to],
          subject: input.subject,
          html: input.html,
        }),
      })

      const body: any = await response.json().catch(() => ({}))
      if (response.ok) {
        return { configured: true, provider: 'resend', id: body?.id || null }
      }

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

async function sendBrevo(input: SendEmailInput): Promise<SendEmailResult> {
  const from = fromAddress()
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
          'api-key': process.env.BREVO_API_KEY!,
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
      if (response.ok) {
        return { configured: true, provider: 'brevo', id: body?.messageId || null }
      }

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

export async function sendFanEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (process.env.RESEND_API_KEY) return sendResend(input)
  if (process.env.BREVO_API_KEY) return sendBrevo(input)
  return { configured: false, error: 'No fan email provider configured.' }
}
