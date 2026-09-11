import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { GET as runRosterSync } from '@/app/api/cron/arbiter-rosters-v2/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

const REPAIR_KEY = 'sx-roster-repair-20260828-7f3c91'

function progressHeartbeat(summary: unknown) {
  try {
    const parsed = typeof summary === 'string' ? JSON.parse(summary) : summary as any
    return parsed?.progress?.heartbeatAt || null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) return NextResponse.json({ ok: false, error: 'Cloudflare D1 binding DB is unavailable' }, { status: 503 })

  const token = req.headers.get('x-sectionx-automation-key') || ''
  const expected = String((env as any).SECTIONX_AUTOMATION_KEY || (env as any).CRON_SECRET || process.env.SECTIONX_AUTOMATION_KEY || process.env.CRON_SECRET || '')
  if (!expected || token !== expected) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const rows = (await db.prepare("SELECT id,summary,started_at FROM arbiter_roster_automation_runs WHERE status='running' AND finished_at IS NULL ORDER BY started_at ASC").all()).results || []
  const cutoff = Date.now() - 10 * 60_000
  const stale = (rows as any[]).filter(row => {
    const heartbeat = progressHeartbeat(row.summary) || row.started_at
    const ts = Date.parse(String(heartbeat || ''))
    return Number.isFinite(ts) && ts < cutoff
  })

  if (!stale.length) return NextResponse.json({ ok: true, recovered: 0, message: 'No stale roster automation run found.' })

  const recovered: string[] = []
  for (const row of stale) {
    let summary: any = {}
    try { summary = row.summary ? JSON.parse(row.summary) : {} } catch {}
    summary = {
      ...summary,
      progress: { ...(summary.progress || {}), phase: 'recovered-stale', heartbeatAt: new Date().toISOString() },
      error: 'Roster worker heartbeat went stale; watchdog retired this run and launched one guarded retry.',
    }
    await db.prepare("UPDATE arbiter_roster_automation_runs SET status='failed',summary=?,finished_at=? WHERE id=? AND status='running' AND finished_at IS NULL")
      .bind(JSON.stringify(summary), new Date().toISOString(), row.id).run()
    recovered.push(row.id)
  }

  const retryRequest = new NextRequest('https://sectionxscoreboard.com/api/cron/arbiter-rosters-v2', {
    method: 'GET',
    headers: { 'x-sectionx-internal-repair': REPAIR_KEY },
  })
  const retryResponse = await runRosterSync(retryRequest)
  const retryBody = await retryResponse.json().catch(() => ({}))

  return NextResponse.json({
    ok: retryResponse.ok,
    recovered: recovered.length,
    recoveredRunIds: recovered,
    retry: retryBody,
  }, { status: retryResponse.ok ? 200 : 207 })
}
