// OpenNext generates this module during the Cloudflare build.
// The custom entry point preserves the normal Next.js fetch handler and adds Cron Trigger support.
import handler from './.open-next/worker.js'

const CRON_ROUTES = new Map([
  ['0 11 * * *', '/api/cron/arbiter-health'],
  ['30 10 * * *', '/api/cron/cross-country-sync'],
  ['0 2 * * *', '/api/cron/overnight-scores'],
  ['0 4 * * *', '/api/cron/overnight-scores'],
  ['0 6 * * *', '/api/cron/overnight-scores'],
  ['0 8 * * *', '/api/cron/overnight-scores'],
  ['0 9 * * *', '/api/cron/overnight-scores'],
])

async function runCronRoute(path, env, ctx) {
  const secret = env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET is not configured on the Cloudflare Worker')

  const request = new Request(`https://sectionxscoreboard.com${path}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${secret}`,
      'user-agent': 'SectionXScoreboard-Cloudflare-Cron/1.0',
    },
  })

  const response = await handler.fetch(request, env, ctx)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Scheduled route ${path} failed with HTTP ${response.status}${body ? `: ${body.slice(0, 500)}` : ''}`)
  }
}

export default {
  fetch: handler.fetch,

  async scheduled(controller, env, ctx) {
    const path = CRON_ROUTES.get(controller.cron)
    if (!path) {
      console.warn(`No Section X cron route mapped for ${controller.cron}`)
      return
    }

    await runCronRoute(path, env, ctx)
  },
}
