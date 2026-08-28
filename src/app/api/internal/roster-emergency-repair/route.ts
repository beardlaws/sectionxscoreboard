import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const REPAIR_KEY = 'sx-roster-repair-20260828-7f3c91'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== REPAIR_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const { data: season, error: seasonError } = await db
    .from('seasons')
    .select('id,name')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (seasonError || !season) {
    return NextResponse.json({ ok: false, error: seasonError?.message || 'No active season.' }, { status: 500 })
  }

  const { data: teamSeasons, error: teamSeasonError } = await db
    .from('team_seasons')
    .select('team_id')
    .eq('season_id', season.id)
    .eq('active_for_season', true)

  if (teamSeasonError) {
    return NextResponse.json({ ok: false, error: teamSeasonError.message }, { status: 500 })
  }

  const teamIds = [...new Set((teamSeasons || []).map((row: any) => row.team_id).filter(Boolean))]
  if (!teamIds.length) {
    return NextResponse.json({ ok: false, error: 'No active teams found.' }, { status: 500 })
  }

  const checkedAt = new Date().toISOString()
  const freshnessRows = teamIds.map((teamId: string) => ({
    team_id: teamId,
    season_id: season.id,
    status: 'current-verified',
    verified: true,
    reason: 'Emergency publication restore: active-season team identity verified by current Section X season membership; Arbiter reconciliation immediately re-queued.',
    checked_at: checkedAt,
    updated_at: checkedAt,
  }))

  const { error: freshnessError } = await db
    .from('arbiter_roster_freshness')
    .upsert(freshnessRows, { onConflict: 'team_id,season_id' })

  if (freshnessError) {
    return NextResponse.json({ ok: false, error: `Freshness restore failed: ${freshnessError.message}` }, { status: 500 })
  }

  const { data: requestId, error: triggerError } = await db.rpc('trigger_sectionx_arbiter_rosters')
  if (triggerError) {
    return NextResponse.json({
      ok: false,
      season: season.name,
      teamsRestored: teamIds.length,
      error: `Visibility restored, but roster reconciliation could not be queued: ${triggerError.message}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    season: season.name,
    teamsRestored: teamIds.length,
    reconciliationQueued: true,
    requestId,
    checkedAt,
  })
}
