import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// /api/admin/* is protected by src/middleware.ts.
export async function GET() {
  const db = createAdminClient()
  const { data: season } = await db.from('seasons').select('id,name').eq('is_active', true).limit(1).maybeSingle()
  if (!season) return NextResponse.json({ ok: false, error: 'No active season.' }, { status: 404 })
  const { data, error } = await db.from('arbiter_roster_freshness_admin').select('*').eq('season_id', season.id).order('verified', { ascending: true }).order('team_name')
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, season: season.name, rows: data || [] })
}
