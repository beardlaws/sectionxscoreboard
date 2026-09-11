import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

function present(value: unknown) {
  return Boolean(String(value || '').trim())
}

export async function GET() {
  try {
    const { env } = getCloudflareContext()
    const runtimeEnv = env as any
    const db = runtimeEnv.DB
    const photos = runtimeEnv.PHOTOS

    if (!db) {
      return Response.json({
        ok: false,
        backend: 'cloudflare',
        bindings: { d1: false, r2: Boolean(photos), assets: Boolean(runtimeEnv.ASSETS) },
        error: 'D1 binding missing',
      }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }

    const [games, schools, photoRows, broadcasts, latestGame, r2List] = await Promise.all([
      db.prepare('SELECT COUNT(*) AS count FROM games').first(),
      db.prepare('SELECT COUNT(*) AS count FROM schools').first(),
      db.prepare('SELECT COUNT(*) AS count FROM photos').first(),
      db.prepare('SELECT COUNT(*) AS count FROM broadcasts').first().catch(() => ({ count: 0 })),
      db.prepare('SELECT game_date, updated_at FROM games ORDER BY game_date DESC, updated_at DESC LIMIT 1').first(),
      photos ? photos.list({ limit: 1 }).catch(() => null) : Promise.resolve(null),
    ])

    const checks = {
      adminAuth: present(runtimeEnv.ADMIN_PASSWORD) && present(runtimeEnv.ADMIN_SESSION_TOKEN),
      automationSecret: present(runtimeEnv.CRON_SECRET) || present(runtimeEnv.SECTIONX_AUTOMATION_KEY),
      arbiter: present(runtimeEnv.ARBITER_CLIENT_ID) && present(runtimeEnv.ARBITER_CLIENT_SECRET),
      realtimeKit: present(runtimeEnv.CLOUDFLARE_ACCOUNT_ID) && present(runtimeEnv.REALTIMEKIT_APP_ID) && present(runtimeEnv.REALTIMEKIT_API_TOKEN),
      r2Read: Boolean(r2List),
    }

    const missing: string[] = []
    if (!checks.adminAuth) missing.push('admin-auth')
    if (!checks.automationSecret) missing.push('automation-secret')
    if (!checks.arbiter) missing.push('arbiter')
    if (!checks.realtimeKit) missing.push('realtimekit')
    if (!photos) missing.push('r2-binding')
    else if (!checks.r2Read) missing.push('r2-read')

    return Response.json({
      ok: missing.length === 0,
      backend: 'cloudflare',
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
      },
      data: {
        latestGameDate: (latestGame as any)?.game_date || null,
        latestGameUpdatedAt: (latestGame as any)?.updated_at || null,
        r2HasObjects: Boolean((r2List as any)?.objects?.length),
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
      error: error instanceof Error ? error.message : 'Cloudflare readiness check failed.',
    }, { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}
