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
        releaseMarker: 'cutover-readiness-v2',
        deployment: version ? { id: version.id || null, tag: version.tag || null } : null,
        bindings: { d1: false, r2: Boolean(photos), assets: Boolean(runtimeEnv.ASSETS) },
        error: 'D1 binding missing',
      }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }

    const [games, schools, photoRows, broadcasts, latestGame, r2Count] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS count FROM games').first(),
      db.prepare('SELECT COUNT(*) AS count FROM schools').first(),
      db.prepare('SELECT COUNT(*) AS count FROM photos').first(),
      db.prepare('SELECT COUNT(*) AS count FROM broadcasts').first().catch(() => ({ count: 0 })),
      db.prepare('SELECT game_date, updated_at FROM games ORDER BY game_date DESC, updated_at DESC LIMIT 1').first(),
      countR2Objects(photos).catch(() => null),
    ])

    const checks = {
      adminAuth: present(runtimeEnv.ADMIN_PASSWORD) && present(runtimeEnv.ADMIN_SESSION_TOKEN),
      automationSecret: present(runtimeEnv.CRON_SECRET) || present(runtimeEnv.SECTIONX_AUTOMATION_KEY),
      automationEnabled: String(runtimeEnv.CLOUDFLARE_AUTOMATION_ENABLED || '').toLowerCase() === 'true',
      arbiter: present(runtimeEnv.ARBITER_CLIENT_ID) && present(runtimeEnv.ARBITER_CLIENT_SECRET),
      realtimeKit: present(runtimeEnv.CLOUDFLARE_ACCOUNT_ID) && present(runtimeEnv.REALTIMEKIT_APP_ID) && present(runtimeEnv.REALTIMEKIT_API_TOKEN),
      r2Read: r2Count !== null,
    }

    const missing: string[] = []
    if (!checks.adminAuth) missing.push('admin-auth')
    if (!checks.automationSecret) missing.push('automation-secret')
    if (!checks.arbiter) missing.push('arbiter')
    if (!checks.realtimeKit) missing.push('realtimekit')
    if (!photos) missing.push('r2-binding')
    else if (!checks.r2Read) missing.push('r2-read')

    return Response.json({
      // Automation is deliberately allowed to remain disabled while this Worker
      // is staging. It becomes a cutover gate, not a staging-readiness failure.
      ok: missing.length === 0,
      backend: 'cloudflare',
      releaseMarker: 'cutover-readiness-v2',
      deployment: version ? { id: version.id || null, tag: version.tag || null } : null,
      bindings: {
        d1: true,
        r2: Boolean(photos),
        assets: Boolean(runtimeEnv.ASSETS),
      },
      checks,
      missing,
      counts: {
        games: Number((games as any)?.count || 0),
        schools: Number((schools as any)?.count || 0),
        photos: Number((photoRows as any)?.count || 0),
        broadcasts: Number((broadcasts as any)?.count || 0),
        r2Objects: r2Count,
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
      releaseMarker: 'cutover-readiness-v2',
      error: error instanceof Error ? error.message : 'Cloudflare readiness check failed.',
    }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}
