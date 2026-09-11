import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

// /api/admin/* is protected by src/middleware.ts.
export async function GET() {
  try {
    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

    const season: any = await db.prepare(
      'SELECT id,name FROM seasons WHERE is_active=1 ORDER BY year DESC LIMIT 1'
    ).first()

    if (!season) return NextResponse.json({ ok: false, error: 'No active season.' }, { status: 404 })

    const result = await db.prepare(`
      SELECT
        f.team_id,
        t.team_name,
        f.season_id,
        s.name AS season_name,
        f.arbiter_team_id,
        f.status,
        f.verified,
        f.reason,
        f.incoming_count,
        f.previous_count,
        f.previous_overlap,
        f.evidence,
        f.checked_at
      FROM arbiter_roster_freshness f
      JOIN teams t ON t.id=f.team_id
      JOIN seasons s ON s.id=f.season_id
      WHERE f.season_id=?
      ORDER BY f.verified ASC, t.team_name ASC
    `).bind(season.id).all()

    const rows = (result.results || []).map((row: any) => ({
      ...row,
      verified: Boolean(row.verified),
      evidence: (() => {
        if (row.evidence == null || row.evidence === '') return null
        if (typeof row.evidence === 'object') return row.evidence
        try { return JSON.parse(String(row.evidence)) } catch { return row.evidence }
      })(),
    }))

    return NextResponse.json({ ok: true, season: season.name, rows })
  } catch (error) {
    console.error('[arbiter-roster-freshness]', error)
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
