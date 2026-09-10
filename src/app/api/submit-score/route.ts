import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

function text(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max)
}
function score(value: unknown) {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && n <= 999 ? n : NaN
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return Response.json({ ok:false, error:'Invalid request.' }, { status:400 })

    const sportName = text((body as any).sport_name, 100)
    const homeTeamName = text((body as any).home_team_name, 140)
    const awayTeamName = text((body as any).away_team_name, 140)
    const gameDate = text((body as any).game_date, 10)
    const submitterName = text((body as any).submitter_name, 120)
    const submitterEmail = text((body as any).submitter_email, 200)
    const notes = text((body as any).notes, 1500)
    const homeScore = score((body as any).home_score)
    const awayScore = score((body as any).away_score)

    if (!sportName || !homeTeamName || !awayTeamName || !/^\d{4}-\d{2}-\d{2}$/.test(gameDate)) {
      return Response.json({ ok:false, error:'Sport, teams, and game date are required.' }, { status:400 })
    }
    if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
      return Response.json({ ok:false, error:'Scores must be whole numbers between 0 and 999.' }, { status:400 })
    }
    if (submitterEmail && !/^\S+@\S+\.\S+$/.test(submitterEmail)) {
      return Response.json({ ok:false, error:'Please enter a valid email address.' }, { status:400 })
    }

    const { env } = getCloudflareContext()
    const db = (env as any).DB
    if (!db) throw new Error('Cloudflare D1 binding DB is unavailable')

    const id = crypto.randomUUID()
    await db.prepare(`
      INSERT INTO submissions (
        id, submitter_name, submitter_email, sport_name, home_team_name, away_team_name,
        home_score, away_score, game_date, notes, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).bind(
      id, submitterName, submitterEmail || null, sportName, homeTeamName, awayTeamName,
      homeScore, awayScore, gameDate, notes || null
    ).run()

    return Response.json({ ok:true, id }, { status:201 })
  } catch (error) {
    console.error('[submit-score]', error)
    return Response.json({ ok:false, error:'Submission failed. Please try again.' }, { status:500 })
  }
}
