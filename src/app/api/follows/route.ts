import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function emailOf(value: unknown) {
  const email = String(value || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = emailOf(body?.email)
    const teamId = body?.teamId ? String(body.teamId) : null
    const athleteId = body?.athleteId ? String(body.athleteId) : null
    if (!email) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    if ((teamId ? 1 : 0) + (athleteId ? 1 : 0) !== 1) return NextResponse.json({ error: 'Choose one team or athlete to follow.' }, { status: 400 })

    const supabase = createAdminClient()
    const prefs = {
      alert_finals: body?.preferences?.finals !== false,
      alert_schedule_changes: body?.preferences?.scheduleChanges !== false,
      alert_live: body?.preferences?.live === true,
      alert_photos: body?.preferences?.photos !== false,
    }

    let lookup = supabase.from('fan_follow_preferences').select('id,manage_token').ilike('email', email)
    lookup = teamId ? lookup.eq('team_id', teamId) : lookup.eq('athlete_id', athleteId)
    const { data: existing, error: lookupError } = await lookup.maybeSingle()
    if (lookupError) throw lookupError

    let manageToken = existing?.manage_token || null
    if (existing?.id) {
      const { data, error } = await supabase.from('fan_follow_preferences').update({ email, ...prefs, active: true }).eq('id', existing.id).select('manage_token').single()
      if (error) throw error
      manageToken = data?.manage_token || manageToken
    } else {
      const { data, error } = await supabase.from('fan_follow_preferences').insert({ email, team_id: teamId, athlete_id: athleteId, ...prefs, active: true }).select('manage_token').single()
      if (error) throw error
      manageToken = data?.manage_token || null
    }

    if (teamId && prefs.alert_finals) {
      const { data: team } = await supabase.from('teams').select('school_id').eq('id', teamId).maybeSingle()
      if (team?.school_id) {
        const { data: sub } = await supabase.from('score_alert_subscriptions').select('id').ilike('email', email).eq('school_id', team.school_id).limit(1).maybeSingle()
        if (!sub?.id) await supabase.from('score_alert_subscriptions').insert({ email, school_id: team.school_id, all_section_x: false, confirmed: true })
      }
    }

    return NextResponse.json({ ok: true, manageToken })
  } catch (error: any) {
    console.error('follow api', error)
    return NextResponse.json({ error: 'Could not save your follow right now.' }, { status: 500 })
  }
}
