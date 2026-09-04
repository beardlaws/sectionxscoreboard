// src/app/admin/submissions/page.tsx
import { createAdminClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import SubmissionQueue from './SubmissionQueue'

export const revalidate = 0

function one<T = any>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null
}

function norm(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bvarsity\b/g, ' ')
    .replace(/\b(boys?|girls?)\b/g, ' ')
    .replace(/\bcentral school district\b/g, ' ')
    .replace(/\bcentral high school\b/g, ' ')
    .replace(/\bcentral school\b/g, ' ')
    .replace(/\bhigh school\b/g, ' ')
    .replace(/\bschool\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function teamNames(game: any, side: 'home' | 'away') {
  const team = one<any>(side === 'home' ? game.home_team : game.away_team)
  const school = one<any>(team?.school)
  const external = one<any>(side === 'home' ? game.external_home : game.external_away)
  return [
    team?.team_name,
    school?.school_name,
    external?.name,
  ].filter(Boolean)
}

function matchesName(input: unknown, names: unknown[]) {
  const needle = norm(input)
  if (!needle) return false
  return names.some(name => norm(name) === needle)
}

export default async function SubmissionsPage() {
  const admin = createAdminClient()

  const [{ data: submissions }, { data: sports }] = await Promise.all([
    admin.from('submissions').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
    admin.from('sports').select('*').order('sport_name'),
  ])

  const dates = Array.from(new Set((submissions || []).map((s: any) => s.game_date).filter(Boolean))) as string[]
  const { data: games } = dates.length
    ? await admin
        .from('games')
        .select(`id,game_date,game_time,status,contest_type,home_score,away_score,verification_status,source,
          sport:sports(id,sport_name,gender),
          home_team:teams!games_home_team_id_fkey(id,team_name,school:schools(id,school_name)),
          away_team:teams!games_away_team_id_fkey(id,team_name,school:schools(id,school_name)),
          external_home:external_opponents!games_external_home_opponent_id_fkey(id,name),
          external_away:external_opponents!games_external_away_opponent_id_fkey(id,name)`)
        .in('game_date', dates)
    : { data: [] as any[] }

  const enriched = (submissions || []).map((sub: any) => {
    const sameSport = (games || []).filter((game: any) => {
      const sport = one<any>(game.sport)
      return game.game_date === sub.game_date && norm(sport?.sport_name) === norm(sub.sport_name)
    })

    const direct = sameSport.filter((game: any) =>
      matchesName(sub.home_team_name, teamNames(game, 'home')) &&
      matchesName(sub.away_team_name, teamNames(game, 'away'))
    )
    const reverse = sameSport.filter((game: any) =>
      matchesName(sub.home_team_name, teamNames(game, 'away')) &&
      matchesName(sub.away_team_name, teamNames(game, 'home'))
    )

    const unique = direct.length === 1 && reverse.length === 0
      ? { game: direct[0], orientation: 'direct' }
      : reverse.length === 1 && direct.length === 0
        ? { game: reverse[0], orientation: 'reversed' }
        : null

    if (!unique) {
      return {
        ...sub,
        canonical_match: null,
        canonical_match_state: direct.length + reverse.length > 1 ? 'ambiguous' : 'unmatched',
        canonical_candidate_count: direct.length + reverse.length,
      }
    }

    const game = unique.game
    const homeTeam = one<any>(game.home_team)
    const awayTeam = one<any>(game.away_team)
    const homeSchool = one<any>(homeTeam?.school)
    const awaySchool = one<any>(awayTeam?.school)
    const externalHome = one<any>(game.external_home)
    const externalAway = one<any>(game.external_away)

    const canonicalHomeName = homeSchool?.school_name || homeTeam?.team_name || externalHome?.name || 'TBD'
    const canonicalAwayName = awaySchool?.school_name || awayTeam?.team_name || externalAway?.name || 'TBD'
    const submittedCanonicalHomeScore = unique.orientation === 'direct' ? sub.home_score : sub.away_score
    const submittedCanonicalAwayScore = unique.orientation === 'direct' ? sub.away_score : sub.home_score
    const alreadyMatches = game.status === 'Final' &&
      Number(game.home_score) === Number(submittedCanonicalHomeScore) &&
      Number(game.away_score) === Number(submittedCanonicalAwayScore)
    const conflicts = game.status === 'Final' &&
      game.home_score != null && game.away_score != null &&
      !alreadyMatches

    return {
      ...sub,
      canonical_match_state: 'matched',
      canonical_candidate_count: 1,
      canonical_match: {
        id: game.id,
        home_name: canonicalHomeName,
        away_name: canonicalAwayName,
        home_score: game.home_score,
        away_score: game.away_score,
        status: game.status,
        game_time: game.game_time,
        contest_type: game.contest_type,
        source: game.source,
        orientation: unique.orientation,
        submitted_home_score: submittedCanonicalHomeScore,
        submitted_away_score: submittedCanonicalAwayScore,
        already_matches: alreadyMatches,
        conflicts,
      },
    }
  })

  return (
    <AdminLayout>
      <div className="p-4 max-w-4xl">
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)' }}>Submission Queue</h1>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          Review public score reports against the canonical Section X game. Fan submissions never create new games.
        </p>
        <SubmissionQueue submissions={enriched as any[]} sports={sports || []} />
      </div>
    </AdminLayout>
  )
}
