import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

function getDb() {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')
  return db
}

function normalizeTime(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const twelveHour = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (twelveHour) {
    let hour = Number(twelveHour[1])
    const minute = twelveHour[2]
    const meridiem = twelveHour[3].toUpperCase()
    if (meridiem === 'AM' && hour === 12) hour = 0
    if (meridiem === 'PM' && hour !== 12) hour += 12
    return `${String(hour).padStart(2, '0')}:${minute}:00`
  }
  const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (twentyFourHour) return `${String(Number(twentyFourHour[1])).padStart(2, '0')}:${twentyFourHour[2]}:00`
  return raw
}

function normalizeStatus(value: unknown): string {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return 'scheduled'
  if (raw === 'ppd' || raw === 'postponed') return 'postponed'
  if (raw === 'cancelled' || raw === 'canceled') return 'canceled'
  if (raw === 'in progress' || raw === 'live') return 'live'
  return raw
}

type VerifiedUpdate = {
  id: string
  game_time?: string | null
  status?: string | null
  source_team_id?: string | null
  source_team_ids?: string[] | null
  season_id?: string | null
  sport_id?: string | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const updates: VerifiedUpdate[] = Array.isArray(body?.updates) ? body.updates : []
    if (!updates.length) return NextResponse.json({ error: 'No verified updates supplied.' }, { status: 400 })

    const db = getDb()
    const results: any[] = []

    for (const item of updates) {
      if (!item?.id) {
        results.push({ id: null, ok: false, error: 'Missing game id.' })
        continue
      }

      const patch: Record<string, any> = {}
      if (Object.prototype.hasOwnProperty.call(item, 'game_time')) patch.game_time = normalizeTime(item.game_time)
      if (Object.prototype.hasOwnProperty.call(item, 'status')) patch.status = item.status || 'Scheduled'

      if (!Object.keys(patch).length) {
        results.push({ id: item.id, ok: false, error: 'No time/status fields supplied.' })
        continue
      }

      const fields = Object.keys(patch)
      const values = fields.map(field => patch[field])
      await db.prepare(`UPDATE games SET ${fields.map(field => `${field}=?`).join(',')}, updated_at=datetime('now') WHERE id=?`)
        .bind(...values, item.id)
        .run()

      const updated: any = await db.prepare('SELECT id, game_time, status FROM games WHERE id=? LIMIT 1').bind(item.id).first()
      if (!updated) {
        results.push({ id: item.id, ok: false, error: 'Update returned no row.' })
        continue
      }

      const expectedTime = Object.prototype.hasOwnProperty.call(patch, 'game_time') ? normalizeTime(patch.game_time) : normalizeTime(updated.game_time)
      const actualTime = normalizeTime(updated.game_time)
      const expectedStatus = Object.prototype.hasOwnProperty.call(patch, 'status') ? normalizeStatus(patch.status) : normalizeStatus(updated.status)
      const actualStatus = normalizeStatus(updated.status)
      const verified = expectedTime === actualTime && expectedStatus === actualStatus
      const sourceIds = [...new Set([...(item.source_team_ids || []), ...(item.source_team_id ? [item.source_team_id] : [])].filter(Boolean))]

      if (verified && item.season_id && item.sport_id && sourceIds.length) {
        let sourceTrackingFailed = false
        for (const sourceTeamId of sourceIds) {
          try {
            const existing: any = await db.prepare('SELECT id FROM game_import_sources WHERE game_id=? AND team_id=? AND season_id=? AND sport_id=? LIMIT 1')
              .bind(item.id, sourceTeamId, item.season_id, item.sport_id)
              .first()
            if (existing?.id) {
              await db.prepare("UPDATE game_import_sources SET source='arbiter', imported_at=datetime('now') WHERE id=?")
                .bind(existing.id)
                .run()
            } else {
              await db.prepare("INSERT INTO game_import_sources (id,game_id,team_id,season_id,sport_id,source,imported_at) VALUES (?,?,?,?,?,'arbiter',datetime('now'))")
                .bind(crypto.randomUUID(), item.id, sourceTeamId, item.season_id, item.sport_id)
                .run()
            }
          } catch (error: any) {
            results.push({ id: item.id, ok: false, error: `Game updated but source tracking failed for ${sourceTeamId}: ${error?.message || String(error)}` })
            sourceTrackingFailed = true
            break
          }
        }
        if (sourceTrackingFailed) continue
      }

      results.push({
        id: item.id,
        ok: verified,
        expected: { game_time: expectedTime, status: expectedStatus },
        actual: { game_time: actualTime, status: actualStatus },
        sources_recorded: sourceIds.length,
        error: verified ? undefined : 'Database read-back did not match the requested verified update.',
      })
    }

    const failed = results.filter(result => !result.ok)
    if (failed.length) {
      return NextResponse.json({
        success: false,
        applied: results.length - failed.length,
        failed: failed.length,
        results,
        error: `${failed.length} verified update${failed.length === 1 ? '' : 's'} failed database read-back verification.`,
      }, { status: 409 })
    }

    return NextResponse.json({ success: true, applied: results.length, failed: 0, results })
  } catch (error: any) {
    console.error('Verified schedule update error:', error)
    return NextResponse.json({ error: error?.message || 'Could not apply verified updates.' }, { status: 500 })
  }
}
