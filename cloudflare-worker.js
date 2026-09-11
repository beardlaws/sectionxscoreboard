// OpenNext generates this module during the Cloudflare build.
// The custom entry point preserves the normal Next.js fetch handler and adds Cron Trigger support.
import handler from './.open-next/worker.js'

const CRON_ROUTES = new Map([
  ['0 11 * * *', ['/api/cron/arbiter-health', '/api/cron/arbiter-pull']],
  ['30 10 * * *', ['/api/cron/cross-country-sync']],
  ['0 2 * * *', ['/api/cron/overnight-scores', '/api/cron/arbiter-pull']],
  ['0 4 * * *', ['/api/cron/overnight-scores']],
  ['0 6 * * *', ['/api/cron/overnight-scores']],
  ['0 8 * * *', ['/api/cron/overnight-scores']],
  ['0 9 * * *', ['/api/cron/overnight-scores']],
  ['0 15 * * *', ['/api/cron/arbiter-pull']],
  ['0 19 * * *', ['/api/cron/arbiter-pull']],
  ['0 23 * * *', ['/api/cron/arbiter-pull']],
  ['30 12 * * *', ['/api/cron/arbiter-rosters-v2']],
  ['*/5 * * * *', ['/api/cron/fan-alerts']],
  ['*/30 * * * *', ['/api/cron/arbiter-roster-watchdog']],
])

function automationEnabled(env) {
  return String(env.CLOUDFLARE_AUTOMATION_ENABLED || '').toLowerCase() === 'true'
}

async function runCronRoute(path, env, ctx) {
  const secret = env.CRON_SECRET || env.SECTIONX_AUTOMATION_KEY
  if (!secret) throw new Error('Neither CRON_SECRET nor SECTIONX_AUTOMATION_KEY is configured on the Cloudflare Worker')

  const request = new Request(`https://sectionxscoreboard.com${path}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${secret}`,
      'x-sectionx-automation-key': secret,
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
    // The migration Worker is also our staging environment. Cron Triggers exist
    // there so the schedule can be validated, but they must not mutate data or
    // send fan alerts until the production cutover is deliberate. Enable them
    // only by setting CLOUDFLARE_AUTOMATION_ENABLED=true on the Worker.
    if (!automationEnabled(env)) {
      console.log(`Cloudflare automation is gated off; skipping ${controller.cron}`)
      return
    }

    const paths = CRON_ROUTES.get(controller.cron)
    if (!paths?.length) {
      console.warn(`No Section X cron route mapped for ${controller.cron}`)
      return
    }

    const results = await Promise.allSettled(paths.map(path => runCronRoute(path, env, ctx)))
    const failures = results.filter(result => result.status === 'rejected')
    if (failures.length) {
      throw new Error(`One or more Section X scheduled jobs failed for ${controller.cron}: ${failures.map(result => result.reason instanceof Error ? result.reason.message : String(result.reason)).join(' | ')}`)
    }
  },
}
