import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sectionXDate } from '@/lib/sectionx-time'

export const dynamic = 'force-dynamic'

const dateOnly = (v: string | null) => {
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return sectionXDate()
}

export async function GET(req: NextRequest) {
  const date = dateOnly(req.nextUrl.searchParams.get('date'))
  const db = createAdminClient()

  try {
    const [
      { data: games, error: ge },
      { data: teams, error: te },
      { data: schools, error: se },
      { data: sports, error: spe },
      { data: ext, error: ee },
    ] = await Promise.all([
      db
        .from('games')
        .select('id,game_date,game_time,sport_id,home_team_id,away_team_id,external_home_opponent_id,external_away_opponent_id,home_score,away_score,status,source,verification_status,contest_type')
        .eq('game_date', date)
        .order('game_time'),
      db.from('teams').select('id,team_name,school_id'),
      db.from('schools').select('id,school_name'),
      db.from('sports').select('id,sport_name,gender'),
      db.from('external_opponents').select('id,name'),
    ])

    const err = ge || te || se || spe || ee
    if (err) throw new Error(err.message)

    const teamById = new Map((teams || []).map((x: any) => [x.id, x]))
    const schoolById = new Map((schools || []).map((x: any) => [x.id, x]))
    const sportById = new Map((sports || []).map((x: any) => [x.id, x]))
    const extById = new Map((ext || []).map((x: any) => [x.id, x]))

    const side = (g: any, home: boolean) => {
      const tid = home ? g.home_team_id : g.away_team_id
      const eid = home ? g.external_home_opponent_id : g.external_away_opponent_id

      if (tid) {
        const t = teamById.get(tid) as any
        const s = schoolById.get(t?.school_id) as any
        return s?.school_name || t?.team_name || 'Unknown'
      }

      return eid ? ((extById.get(eid) as any)?.name || 'External') : 'TBA'
    }

    const rows = (games || []).map((g: any) => {
      const s = sportById.get(g.sport_id) as any
      const scored = g.home_score != null && g.away_score != null
      const status = String(g.status || '').toLowerCase()
      const final = status === 'final'
      const scrimmage = String(g.contest_type || '').toLowerCase() === 'scrimmage'
      const excluded = ['canceled', 'cancelled', 'postponed'].includes(status)

      return {
        id: g.id,
        date: g.game_date,
        time: g.game_time,
        sport: s?.sport_name || 'Unknown',
        gender: s?.gender || null,
        home: side(g, true),
        away: side(g, false),
        homeScore: g.home_score,
        awayScore: g.away_score,
        status: g.status,
        source: g.source,
        verificationStatus: g.verification_status,
        contestType: g.contest_type,
        resultState: scrimmage
          ? 'scrimmage'
          : excluded
            ? 'excluded'
            : final && scored
              ? 'final'
              : scored
                ? 'score-reported'
                : 'missing-result',
      }
    })

    const officialRows = rows.filter((r: any) => !['scrimmage', 'excluded'].includes(r.resultState))
    const final = officialRows.filter((r: any) => r.resultState === 'final').length
    const reported = officialRows.filter((r: any) => r.resultState === 'score-reported').length
    const missing = officialRows.filter((r: any) => r.resultState === 'missing-result').length
    const complete = final + reported
    const officialGames = officialRows.length
    const coverage = officialGames ? Math.round((complete / officialGames) * 100) : 100

    return NextResponse.json({
      ok: true,
      date,
      summary: {
        games: rows.length,
        officialGames,
        final,
        reported,
        missing,
        scrimmages: rows.filter((r: any) => r.resultState === 'scrimmage').length,
        excluded: rows.filter((r: any) => r.resultState === 'excluded').length,
        coverage,
      },
      rows,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Daily results lookup failed',
    }, { status: 500 })
  }
}
