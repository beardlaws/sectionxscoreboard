import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { calculateStandings } from '@/lib/standings';
import ScoreCard from '@/components/scores/ScoreCard';
import { GameWithTeams } from '@/types';
import { Trophy } from 'lucide-react';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient();
  const { data: team } = await supabase
    .from('teams')
    .select('team_name, school:schools(school_name), sport:sports(sport_name)')
    .eq('slug', params.slug)
    .single();

  if (!team) return {};
  const s = team.school as any;
  const sp = team.sport as any;
  return {
    title: `${s?.school_name} ${sp?.sport_name} | Section X Scoreboard`,
    description: `${team.team_name} scores, schedule, and standings. Section X Northern NY high school sports.`,
  };
}

export default async function TeamPage({ params }: Props) {
  const supabase = createClient();

  const { data: team } = await supabase
    .from('teams')
    .select('*, school:schools(*), sport:sports(*)')
    .eq('slug', params.slug)
    .single();

  if (!team) notFound();

  const school = team.school as any;
  const sport = team.sport as any;

  const { data: activeSeason } = await supabase.from('seasons').select('*').eq('is_active', true).single();

  // Team's games - filter by sport_id to prevent cross-sport contamination
  const teamSportId = (team.sport as any)?.id || team.sport_id;
  let gamesQuery = supabase
    .from('games')
    .select(`
      *,
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*)),
      external_home:external_opponents!games_external_home_opponent_id_fkey(name),
      external_away:external_opponents!games_external_away_opponent_id_fkey(name)
    `)
    .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`);

  if (activeSeason) gamesQuery = gamesQuery.eq('season_id', activeSeason.id);
  if (teamSportId) gamesQuery = gamesQuery.eq('sport_id', teamSportId);

  const { data: gamesData } = await gamesQuery.order('game_date', { ascending: false });

  const games = (gamesData as GameWithTeams[]) || [];

  // Team record — golf: lower score wins; all other sports: higher score wins
  const isGolfTeam = (sport as any)?.sport_name?.toLowerCase().includes('golf');
  const finalGames = games.filter(g => g.status === 'Final');
  let wins = 0, losses = 0, ties = 0;
  finalGames.forEach(g => {
    if (g.home_score == null || g.away_score == null) return;
    const isHome = g.home_team_id === team.id;
    const myScore = isHome ? g.home_score : g.away_score;
    const oppScore = isHome ? g.away_score : g.home_score;
    const iWin = isGolfTeam ? myScore < oppScore : myScore > oppScore;
    const iLose = isGolfTeam ? myScore > oppScore : myScore < oppScore;
    if (iWin) wins++;
    else if (iLose) losses++;
    else ties++;
  });

  const upcomingGames = games.filter(g => g.status === 'Scheduled').reverse();
  const recentGames = games.filter(g => g.status === 'Final');

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{
          background: `linear-gradient(135deg, ${school?.primary_color || '#1e3a5f'}dd, ${school?.secondary_color || '#0f172a'}aa)`,
        }}
      >
        <div className="flex items-center gap-2 mb-2 text-white/60 text-sm">
          <Link href={`/schools/${school?.slug}`} className="hover:text-white">{school?.school_name}</Link>
          <span>/</span>
          <Link href={`/sports/${sport?.slug}`} className="hover:text-white">{sport?.sport_name}</Link>
        </div>
        <h1 className="text-3xl font-bold font-display text-white">{team.team_name}</h1>
        {activeSeason && (
          <p className="text-white/70 text-sm mt-1">{activeSeason.name}</p>
        )}
        {/* Record */}
        <div className="flex gap-6 mt-4">
          <div className="text-center">
            <p className="text-3xl font-bold font-display text-white score-number">{wins}</p>
            <p className="text-xs text-white/60 uppercase tracking-wide">W</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold font-display text-white score-number">{losses}</p>
            <p className="text-xs text-white/60 uppercase tracking-wide">L</p>
          </div>
          {ties > 0 && (
            <div className="text-center">
              <p className="text-3xl font-bold font-display text-white score-number">{ties}</p>
              <p className="text-xs text-white/60 uppercase tracking-wide">T</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming */}
      {upcomingGames.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Upcoming Games</h2>
          <div className="space-y-2">
            {upcomingGames.map(g => <ScoreCard key={g.id} game={g} compact />)}
          </div>
        </section>
      )}

      {/* Results */}
      {recentGames.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Results</h2>
          <div className="space-y-2">
            {recentGames.map(g => <ScoreCard key={g.id} game={g} compact highlightTeamId={team.id} />)}
          </div>
        </section>
      )}

      {games.length === 0 && (
        <div className="card p-8 text-center text-slate-400">No games found for this team this season.</div>
      )}
    </div>
  );
}
