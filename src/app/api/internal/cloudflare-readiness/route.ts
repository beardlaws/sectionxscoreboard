import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

function present(value: unknown) {
  return Boolean(String(value || '').trim())
}

async function countR2Objects(bucket: any) {
  if (!bucket) return null
  let cursor: string | undefined
  let count = 0
  do {
    const page = await bucket.list({ limit: 1000, ...(cursor ? { cursor } : {}) })
    count += Array.isArray(page?.objects) ? page.objects.length : 0
    cursor = page?.truncated && page?.cursor ? String(page.cursor) : undefined
  } while (cursor)
  return count
}

async function count(db: any, table: string) {
  const row: any = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first()
  return Number(row?.count || 0)
}

export async function GET() {
  try {
    const { env } = getCloudflareContext()
    const runtimeEnv = env as any
    const db = runtimeEnv.DB
    const photos = runtimeEnv.PHOTOS
    const version = runtimeEnv.CF_VERSION_METADATA || null

    if (!db) {
      return Response.json({
        ok: false,
        backend: 'cloudflare',
        releaseMarker: 'cutover-readiness-v3',
        deployment: version ? { id: version.id || null, tag: version.tag || null } : null,
        bindings: { d1: false, r2: Boolean(photos), assets: Boolean(runtimeEnv.ASSETS) },
        error: 'D1 binding missing',
      }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }

    const [
      games, schools, teams, athletes, rosterEntries, photoRows, arbiterLinks,
      scoreAlerts, fanFollows, trafficEvents, sponsorImpressions, broadcasts,
      latestGame, referencedLogos, r2Count,
    ] = await Promise.all([
      count(db,'games'), count(db,'schools'), count(db,'teams'), count(db,'athletes'),
      count(db,'roster_entries'), count(db,'photos'), count(db,'arbiter_game_links'),
      count(db,'score_alert_subscriptions'), count(db,'fan_follow_preferences'),
      count(db,'site_traffic_events'), count(db,'sponsor_impressions'),
      count(db,'broadcasts').catch(() => 0),
      db.prepare('SELECT game_date, updated_at FROM games ORDER BY game_date DESC, updated_at DESC LIMIT 1').first(),
      db.prepare("SELECT COUNT(*) AS count FROM schools WHERE logo_url IS NOT NULL AND trim(logo_url) <> ''").first(),
      countR2Objects(photos).catch(() => null),
    ])

    const checks = {
      adminAuth: present(runtimeEnv.ADMIN_PASSWORD) && present(runtimeEnv.ADMIN_SESSION_TOKEN),
      automationSecret: present(runtimeEnv.CRON_SECRET) || present(runtimeEnv.SECTIONX_AUTOMATION_KEY),
      automationEnabled: String(runtimeEnv.CLOUDFLARE_AUTOMATION_ENABLED || '').toLowerCase() === 'true',
      arbiter: present(runtimeEnv.ARBITER_CLIENT_ID) && present(runtimeEnv.ARBITER_CLIENT_SECRET),
      contributorEmail: present(runtimeEnv.RESEND_API_KEY),
      fanEmail: present(runtimeEnv.RESEND_API_KEY) || present(runtimeEnv.BREVO_API_KEY),
      realtimeKit: present(runtimeEnv.CLOUDFLARE_ACCOUNT_ID) && present(runtimeEnv.REALTIMEKIT_APP_ID) && present(runtimeEnv.REALTIMEKIT_API_TOKEN),
      r2Read: r2Count !== null,
    }

    const missing: string[] = []
    if (!checks.adminAuth) missing.push('admin-auth')
    if (!checks.automationSecret) missing.push('automation-secret')
    if (!checks.arbiter) missing.push('arbiter')
    if (!checks.contributorEmail) missing.push('contributor-email')
    if (!checks.fanEmail) missing.push('fan-email')
    if (!checks.realtimeKit) missing.push('realtimekit')
    if (!photos) missing.push('r2-binding')
    else if (!checks.r2Read) missing.push('r2-read')

    const logoCount = Number((referencedLogos as any)?.count || 0)
    const minimumReferencedMedia = photoRows + logoCount

    return Response.json({
      // Automation remains deliberately disabled in staging. It is turned on
      // only as part of the controlled production scheduler handoff.
      ok: missing.length === 0,
      backend: 'cloudflare',
      releaseMarker: 'cutover-readiness-v3',
      deployment: version ? { id: version.id || null, tag: version.tag || null } : null,
      bindings: { d1: true, r2: Boolean(photos), assets: Boolean(runtimeEnv.ASSETS) },
      checks,
      missing,
      counts: {
        games, schools, teams, athletes, rosterEntries, photos: photoRows,
        arbiterGameLinks: arbiterLinks, scoreAlertSubscriptions: scoreAlerts,
        fanFollows, siteTrafficEvents: trafficEvents, sponsorImpressions,
        broadcasts, referencedLogos: logoCount, r2Objects: r2Count,
        minimumReferencedMedia,
      },
      data: {
        latestGameDate: (latestGame as any)?.game_date || null,
        latestGameUpdatedAt: (latestGame as any)?.updated_at || null,
      },
      liveAudio: {
        configured: checks.realtimeKit,
        publisherPreset: String(runtimeEnv.REALTIMEKIT_PUBLISHER_PRESET || 'section-x-broadcaster'),
        listenerPreset: String(runtimeEnv.REALTIMEKIT_LISTENER_PRESET || 'section-x-listener'),
      },
    }, { status: missing.length === 0 ? 200 : 503, headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    console.error('[cloudflare-readiness]', error)
    return Response.json({
      ok: false,
      backend: 'cloudflare',
      releaseMarker: 'cutover-readiness-v3',
      error: error instanceof Error ? error.message : 'Cloudflare readiness check failed.',
    }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}
