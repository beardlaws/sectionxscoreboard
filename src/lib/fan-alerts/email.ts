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

const fromAddress = () => process.env.FAN_ALERTS_FROM || 'Section X Scoreboard <alerts@sectionxscoreboard.com>'

export function fanEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY)
}

export async function sendFanEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ from: fromAddress(), to: [input.to], subject: input.subject, html: input.html }),
      })
      const body: any = await response.json().catch(() => ({}))
      if (!response.ok) return { configured: true, provider: 'resend', error: body?.message || `Resend HTTP ${response.status}` }
      return { configured: true, provider: 'resend', id: body?.id || null }
    } catch (error) {
      return { configured: true, provider: 'resend', error: error instanceof Error ? error.message : String(error) }
    }
  }

  if (process.env.BREVO_API_KEY) {
    try {
      const from = fromAddress()
      const match = from.match(/^(.*?)\s*<([^>]+)>$/)
      const sender = match ? { name: match[1].trim(), email: match[2].trim() } : { name: 'Section X Scoreboard', email: from }
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ sender, to: [{ email: input.to }], subject: input.subject, htmlContent: input.html }),
      })
      const body: any = await response.json().catch(() => ({}))
      if (!response.ok) return { configured: true, provider: 'brevo', error: body?.message || `Brevo HTTP ${response.status}` }
      return { configured: true, provider: 'brevo', id: body?.messageId || null }
    } catch (error) {
      return { configured: true, provider: 'brevo', error: error instanceof Error ? error.message : String(error) }
    }
  }

  return { configured: false, error: 'No fan email provider configured.' }
}
