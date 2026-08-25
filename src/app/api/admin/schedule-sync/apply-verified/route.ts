import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
  // Middleware authenticates the admin session before this service-role writer executes.
  try {
    const body = await req.json()
    const updates: VerifiedUpdate[] = Array.isArray(body?.updates) ? body.updates : []
    if (!updates.length) return NextResponse.json({ error: 'No verified updates supplied.' }, { status: 400 })

    const supabase = getAdminClient()
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

      const { data: updated, error: updateError } = await supabase
        .from('games')
        .update(patch)
        .eq('id', item.id)
        .select('id, game_time, status')
        .single()

      if (updateError || !updated) {
        results.push({ id: item.id, ok: false, error: updateError?.message || 'Update returned no row.' })
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
          const { error: sourceError } = await supabase
            .from('game_import_sources')
            .upsert({
              game_id: item.id,
              team_id: sourceTeamId,
              season_id: item.season_id,
              sport_id: item.sport_id,
              source: 'arbiter',
              imported_at: new Date().toISOString(),
            }, { onConflict: 'game_id,team_id,season_id,sport_id' })
          if (sourceError) {
            results.push({ id: item.id, ok: false, error: `Game updated but source tracking failed for ${sourceTeamId}: ${sourceError.message}` })
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
