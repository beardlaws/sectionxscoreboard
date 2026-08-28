import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { fanEmailConfigured, sendFanEmail } from '@/lib/fan-alerts/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const prefColumn: Record<string, string> = {
  final: 'alert_finals',
  live: 'alert_live',
  'schedule-change': 'alert_schedule_changes',
  photo: 'alert_photos',
}

function joined<T = any>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null
}

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
}

function gameNames(game: any) {
  const home = joined<any>(game?.home_team)
  const away = joined<any>(game?.away_team)
  const homeSchool = joined<any>(home?.school)
  const awaySchool = joined<any>(away?.school)
  return {
    home: home?.team_name || homeSchool?.school_name || 'Home team',
    away: away?.team_name || awaySchool?.school_name || 'Away team',
  }
}

function emailCopy(event: any, game: any, manageToken: string) {
  const names = gameNames(game)
  const gameUrl = game?.id ? `https://sectionxscoreboard.com/game-center/${game.id}` : 'https://sectionxscoreboard.com'
  const manageUrl = `https://sectionxscoreboard.com/following?token=${encodeURIComponent(manageToken)}`
  const eventType = event.event_type
  let subject = 'Section X update'
  let headline = 'Section X update'
  let detail = ''

  if (eventType === 'final') {
    subject = `${names.away} ${game?.away_score ?? '—'}, ${names.home} ${game?.home_score ?? '—'} — Final`
    headline = 'Final score'
    detail = `${names.away} ${game?.away_score ?? '—'} · ${names.home} ${game?.home_score ?? '—'}`
  } else if (eventType === 'live') {
    subject = `${names.away} at ${names.home} is live`
    headline = 'Game is live'
    detail = `${names.away} at ${names.home}`
  } else if (eventType === 'schedule-change') {
    subject = `${names.away} at ${names.home} schedule update`
    headline = 'Schedule update'
    detail = `${names.away} at ${names.home} · ${game?.game_date || ''} ${game?.game_time || ''}`.trim()
  } else if (eventType === 'photo') {
    subject = `New Section X photos${game ? `: ${names.away} at ${names.home}` : ''}`
    headline = 'New photos are up'
    detail = game ? `${names.away} at ${names.home}` : 'A followed Section X athlete or team has new approved photos.'
  }

  return {
    subject,
    html: `<!doctype html><html><body style="margin:0;background:#070b12;color:#fff;font-family:Arial,sans-serif"><div style="max-width:620px;margin:0 auto;padding:28px"><div style="font-size:12px;letter-spacing:.18em;color:#facc15;font-weight:700">SECTION X SCOREBOARD</div><h1 style="font-size:28px;margin:10px 0 8px">${esc(headline)}</h1><p style="font-size:17px;color:#dbe4f0">${esc(detail)}</p><p style="margin:28px 0"><a href="${gameUrl}" style="background:#facc15;color:#000;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Open Section X</a></p><p style="font-size:12px;color:#7c8ba1">You received this because you follow a Section X team or athlete. <a href="${manageUrl}" style="color:#9fb9ff">Manage alerts or unsubscribe</a>.</p></div></body></html>`,
  }
}

export async function GET(req: NextRequest) {
  const db = createAdminClient()
  const token = req.headers.get('x-sectionx-automation-key') || ''
  const { data: allowed, error: authError } = await db.rpc('verify_sectionx_automation_key', { p_token: token })
  if (authError || allowed !== true) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  if (!fanEmailConfigured()) {
    return NextResponse.json({ ok: true, configured: false, message: 'Fan alert queue is armed; add RESEND_API_KEY or BREVO_API_KEY to begin email delivery.' })
  }

  const { data: events, error } = await db
    .from('fan_notification_events')
    .select('*')
    .in('status', ['pending', 'error'])
    .order('created_at', { ascending: true })
    .limit(30)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  let sent = 0, skipped = 0, failed = 0

  for (const event of events || []) {
    try {
      let game: any = null
      let teamIds: string[] = []
      let athleteIds: string[] = []

      if (event.game_id) {
        const { data } = await db.from('games').select(`id,game_date,game_time,status,home_score,away_score,home_team_id,away_team_id,home_team:teams!games_home_team_id_fkey(id,team_name,school:schools(school_name)),away_team:teams!games_away_team_id_fkey(id,team_name,school:schools(school_name))`).eq('id', event.game_id).maybeSingle()
        game = data
        teamIds = [data?.home_team_id, data?.away_team_id].filter(Boolean)
      }

      if (event.photo_id) {
        const { data: tags } = await db.from('photo_athletes').select('athlete_id').eq('photo_id', event.photo_id)
        athleteIds = (tags || []).map((x: any) => x.athlete_id).filter(Boolean)
      }

      const follows: any[] = []
      if (teamIds.length) {
        const { data } = await db.from('fan_follow_preferences').select('*').eq('active', true).in('team_id', teamIds)
        follows.push(...(data || []))
      }
      if (athleteIds.length) {
        const { data } = await db.from('fan_follow_preferences').select('*').eq('active', true).in('athlete_id', athleteIds)
        follows.push(...(data || []))
      }

      const unique = Array.from(new Map(follows.map(f => [f.id, f])).values())
      const pref = prefColumn[event.event_type]
      const wanted = unique.filter((f: any) => pref && f[pref] === true)

      if (!wanted.length) {
        await db.from('fan_notification_events').update({ status: 'skipped', processed_at: new Date().toISOString(), last_error: null }).eq('id', event.id)
        skipped++
        continue
      }

      let eventFailed = false
      for (const follow of wanted) {
        const { data: existing } = await db.from('fan_notification_deliveries').select('id,status').eq('event_id', event.id).eq('follow_id', follow.id).maybeSingle()
        if (existing?.status === 'sent') continue

        const copy = emailCopy(event, game, follow.manage_token)
        const result = await sendFanEmail({ to: follow.email, subject: copy.subject, html: copy.html })
        const now = new Date().toISOString()

        if (result.error) {
          eventFailed = true
          failed++
          await db.from('fan_notification_deliveries').upsert({ event_id: event.id, follow_id: follow.id, email: follow.email, status: 'error', provider: result.provider || null, provider_id: result.id || null, error: result.error }, { onConflict: 'event_id,follow_id' })
        } else {
          sent++
          await db.from('fan_notification_deliveries').upsert({ event_id: event.id, follow_id: follow.id, email: follow.email, status: 'sent', provider: result.provider || null, provider_id: result.id || null, error: null, sent_at: now }, { onConflict: 'event_id,follow_id' })
        }
      }

      await db.from('fan_notification_events').update({ status: eventFailed ? 'error' : 'sent', processed_at: eventFailed ? null : new Date().toISOString(), last_error: eventFailed ? 'One or more deliveries failed.' : null }).eq('id', event.id)
    } catch (eventError) {
      failed++
      await db.from('fan_notification_events').update({ status: 'error', last_error: eventError instanceof Error ? eventError.message : String(eventError) }).eq('id', event.id)
    }
  }

  return NextResponse.json({ ok: true, configured: true, events: events?.length || 0, sent, skipped, failed })
}
