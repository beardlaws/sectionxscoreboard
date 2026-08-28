import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function maskEmail(email: string) {
  const [name, domain] = String(email || '').split('@')
  if (!domain) return 'hidden'
  const visible = name.slice(0, Math.min(2, name.length))
  return `${visible}${'*'.repeat(Math.max(2, name.length - visible.length))}@${domain}`
}

async function ownerFromToken(token: string) {
  const db = createAdminClient()
  const { data } = await db.from('fan_follow_preferences').select('email').eq('manage_token', token).maybeSingle()
  return { db, email: data?.email || null }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim() || ''
  if (!token) return NextResponse.json({ error: 'Missing management token.' }, { status: 400 })
  const { db, email } = await ownerFromToken(token)
  if (!email) return NextResponse.json({ error: 'This management link is invalid.' }, { status: 404 })

  const { data, error } = await db.from('fan_follow_preferences').select(`id,team_id,athlete_id,alert_finals,alert_schedule_changes,alert_live,alert_photos,active,team:teams(team_name,slug),athlete:athletes(display_name,slug)`).ilike('email', email).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    email: maskEmail(email),
    follows: (data || []).map((row: any) => ({
      id: row.id,
      type: row.team_id ? 'team' : 'athlete',
      name: (Array.isArray(row.team) ? row.team[0]?.team_name : row.team?.team_name) || (Array.isArray(row.athlete) ? row.athlete[0]?.display_name : row.athlete?.display_name) || 'Section X follow',
      active: row.active,
      preferences: { finals: row.alert_finals, scheduleChanges: row.alert_schedule_changes, live: row.alert_live, photos: row.alert_photos },
    })),
  })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const token = String(body?.token || '').trim()
  const followId = String(body?.followId || '').trim()
  if (!token || !followId) return NextResponse.json({ error: 'Missing management token or follow.' }, { status: 400 })
  const { db, email } = await ownerFromToken(token)
  if (!email) return NextResponse.json({ error: 'This management link is invalid.' }, { status: 404 })

  const patch: any = {}
  if (typeof body.active === 'boolean') patch.active = body.active
  if (body.preferences) {
    patch.alert_finals = body.preferences.finals === true
    patch.alert_schedule_changes = body.preferences.scheduleChanges === true
    patch.alert_live = body.preferences.live === true
    patch.alert_photos = body.preferences.photos === true
  }

  const { data, error } = await db.from('fan_follow_preferences').update(patch).eq('id', followId).ilike('email', email).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Follow not found.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const token = String(body?.token || '').trim()
  if (!token) return NextResponse.json({ error: 'Missing management token.' }, { status: 400 })
  const { db, email } = await ownerFromToken(token)
  if (!email) return NextResponse.json({ error: 'This management link is invalid.' }, { status: 404 })
  const { error } = await db.from('fan_follow_preferences').update({ active: false }).ilike('email', email)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
