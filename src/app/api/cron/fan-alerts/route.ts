import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { fanEmailConfigured, sendFanEmail } from '@/lib/fan-alerts/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const prefColumn: Record<string, string> = {
  final: 'alert_finals',
  live: 'alert_live',
  'schedule-change': 'alert_schedule_changes',
  photo: 'alert_photos',
}

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
}

function placeholders(n: number) { return Array.from({ length: n }, () => '?').join(',') }

function gameNames(game: any) {
  return {
    home: game?.home_team_name || game?.home_school_name || 'Home team',
    away: game?.away_team_name || game?.away_school_name || 'Away team',
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

async function upsertDelivery(db: any, args: {
  eventId: string
  followId: string
  email: string
  status: string
  provider: string | null
  providerId: string | null
  error: string | null
  sentAt: string | null
}) {
  const existing: any = await db.prepare('SELECT id FROM fan_notification_deliveries WHERE event_id=? AND follow_id=? LIMIT 1')
    .bind(args.eventId, args.followId).first()
  if (existing?.id) {
    await db.prepare('UPDATE fan_notification_deliveries SET email=?,status=?,provider=?,provider_id=?,error=?,sent_at=? WHERE id=?')
      .bind(args.email, args.status, args.provider, args.providerId, args.error, args.sentAt, existing.id).run()
    return
  }
  await db.prepare('INSERT INTO fan_notification_deliveries (id,event_id,follow_id,email,status,provider,provider_id,error,created_at,sent_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), args.eventId, args.followId, args.email, args.status, args.provider, args.providerId, args.error, new Date().toISOString(), args.sentAt).run()
}

export async function GET(req: NextRequest) {
  const { env } = getCloudflareContext()
  const db = (env as any).DB
  if (!db) return NextResponse.json({ ok: false, error: 'Cloudflare D1 binding DB is unavailable' }, { status: 503 })

  const token = req.headers.get('x-sectionx-automation-key') || ''
  const expected = String((env as any).SECTIONX_AUTOMATION_KEY || (env as any).CRON_SECRET || process.env.SECTIONX_AUTOMATION_KEY || process.env.CRON_SECRET || '')
  if (!expected || token !== expected) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  if (!fanEmailConfigured()) {
    return NextResponse.json({ ok: true, configured: false, message: 'Fan alert queue is armed; add RESEND_API_KEY or BREVO_API_KEY to begin email delivery.' })
  }

  const eventResult = await db.prepare("SELECT * FROM fan_notification_events WHERE status IN ('pending','error') ORDER BY created_at ASC LIMIT 30").all()
  const events = eventResult.results || []
  let sent = 0, skipped = 0, failed = 0

  for (const event of events as any[]) {
    try {
      let game: any = null
      let teamIds: string[] = []
      let athleteIds: string[] = []

      if (event.game_id) {
        game = await db.prepare(`
          SELECT g.id,g.game_date,g.game_time,g.status,g.home_score,g.away_score,g.home_team_id,g.away_team_id,
            ht.team_name AS home_team_name,hs.school_name AS home_school_name,
            at.team_name AS away_team_name,ats.school_name AS away_school_name
          FROM games g
          LEFT JOIN teams ht ON ht.id=g.home_team_id LEFT JOIN schools hs ON hs.id=ht.school_id
          LEFT JOIN teams at ON at.id=g.away_team_id LEFT JOIN schools ats ON ats.id=at.school_id
          WHERE g.id=? LIMIT 1`).bind(event.game_id).first()
        teamIds = [game?.home_team_id, game?.away_team_id].filter(Boolean)
      }

      if (event.photo_id) {
        const tags = await db.prepare('SELECT athlete_id FROM photo_athletes WHERE photo_id=?').bind(event.photo_id).all()
        athleteIds = (tags.results || []).map((x: any) => x.athlete_id).filter(Boolean)
      }

      const follows: any[] = []
      if (teamIds.length) {
        const rows = await db.prepare(`SELECT * FROM fan_follow_preferences WHERE active=1 AND team_id IN (${placeholders(teamIds.length)})`).bind(...teamIds).all()
        follows.push(...(rows.results || []))
      }
      if (athleteIds.length) {
        const rows = await db.prepare(`SELECT * FROM fan_follow_preferences WHERE active=1 AND athlete_id IN (${placeholders(athleteIds.length)})`).bind(...athleteIds).all()
        follows.push(...(rows.results || []))
      }

      const unique = Array.from(new Map(follows.map((f: any) => [f.id, f])).values()) as any[]
      const pref = prefColumn[event.event_type]
      const wanted = unique.filter((f: any) => pref && Boolean(f[pref]))

      if (!wanted.length) {
        await db.prepare("UPDATE fan_notification_events SET status='skipped',processed_at=?,last_error=NULL WHERE id=?").bind(new Date().toISOString(), event.id).run()
        skipped++
        continue
      }

      let eventFailed = false
      for (const follow of wanted) {
        const existing: any = await db.prepare('SELECT id,status FROM fan_notification_deliveries WHERE event_id=? AND follow_id=? LIMIT 1').bind(event.id, follow.id).first()
        if (existing?.status === 'sent') continue

        const copy = emailCopy(event, game, follow.manage_token)
        const result = await sendFanEmail({ to: follow.email, subject: copy.subject, html: copy.html })
        const now = new Date().toISOString()

        if (result.error) {
          eventFailed = true
          failed++
          await upsertDelivery(db, { eventId: event.id, followId: follow.id, email: follow.email, status: 'error', provider: result.provider || null, providerId: result.id || null, error: result.error, sentAt: null })
        } else {
          sent++
          await upsertDelivery(db, { eventId: event.id, followId: follow.id, email: follow.email, status: 'sent', provider: result.provider || null, providerId: result.id || null, error: null, sentAt: now })
        }
      }

      await db.prepare('UPDATE fan_notification_events SET status=?,processed_at=?,last_error=? WHERE id=?')
        .bind(eventFailed ? 'error' : 'sent', eventFailed ? null : new Date().toISOString(), eventFailed ? 'One or more deliveries failed.' : null, event.id).run()
    } catch (eventError) {
      failed++
      await db.prepare("UPDATE fan_notification_events SET status='error',last_error=? WHERE id=?")
        .bind(eventError instanceof Error ? eventError.message : String(eventError), event.id).run()
    }
  }

  return NextResponse.json({ ok: true, configured: true, events: events.length, sent, skipped, failed })
}
