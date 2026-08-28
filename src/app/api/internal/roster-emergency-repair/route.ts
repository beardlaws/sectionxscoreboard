import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const REPAIR_KEY = 'sx-roster-repair-20260828-7f3c91'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== REPAIR_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const { data: season, error: seasonError } = await db.from('seasons').select('id,name').eq('is_active', true).limit(1).maybeSingle()
  if (seasonError || !season) return NextResponse.json({ ok: false, error: seasonError?.message || 'No active season.' }, { status: 500 })

  // Restore visibility for already-imported active-season rows. The corrected
  // reconciliation will immediately replace these audit rows with its actual
  // per-team classification and only imports non-empty, non-stale Arbiter data.
  const { data: teamSeasons, error: teamSeasonError } = await db.from('team_seasons').select('team_id').eq('season_id', season.id).eq('active_for_season', true)
  if (teamSeasonError) return NextResponse.json({ ok: false, error: teamSeasonError.message }, { status: 500 })

  const teamIds = [...new Set((teamSeasons || []).map((row: any) => row.team_id).filter(Boolean))]
  const checkedAt = new Date().toISOString()
  if (teamIds.length) {
    const rows = teamIds.map((teamId: string) => ({ team_id: teamId, season_id: season.id, status: 'current-verified', verified: true, reason: 'Emergency visibility restore pending corrected Arbiter reconciliation.', checked_at: checkedAt }))
    const { error } = await db.from('arbiter_roster_freshness').upsert(rows, { onConflict: 'team_id,season_id' })
    if (error) return NextResponse.json({ ok: false, error: `Visibility restore failed: ${error.message}` }, { status: 500 })
  }

  const { data: requestId, error: triggerError } = await db.rpc('trigger_sectionx_arbiter_rosters')
  if (triggerError) return NextResponse.json({ ok: false, season: season.name, teamsRestored: teamIds.length, error: `Visibility restored, but reconciliation could not be queued: ${triggerError.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, season: season.name, teamsRestored: teamIds.length, reconciliationQueued: true, requestId, checkedAt })
}
