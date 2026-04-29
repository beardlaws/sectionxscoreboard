import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { ALL_SPORTS } from '@/lib/constants';
import { calculateStandings } from '@/lib/standings';
import ScoreCard from '@/components/scores/ScoreCard';
import { GameWithTeams } from '@/types';
import { Trophy } from 'lucide-react';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sport = ALL_SPORTS.find(s => s.slug === params.slug);
  if (!sport) return {};
  return {
    title: `${sport.name} Scores & Standings | Section X Scoreboard`,
    description: `Section X ${sport.name} scores, schedules, and standings. Northern NY high school sports.`,
  };
}

export default async function SportPage({ params }: Props) {
  const sport = ALL_SPORTS.find(s => s.slug === params.slug);
  if (!sport) notFound();

  const supabase = createClient();

  // Get active season + sport record
  const [{ data: activeSeason }, { data: sportRecord }] = await Promise.all([
    supabase.from('seasons').select('*').eq('is_active', true).single(),
    supabase.from('sports').select('*').eq('slug', params.slug).single(),
  ]);

  if (!sportRecord) notFound();

  // Get recent + upcoming games
  const today = new Date().toISOString().split('T')[0];
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  const twoWeeksAhead = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

  const { data: gamesData } = await supabase
    .from('games')
    .select(`
      *,
      home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
      away_team:teams!games_away_team_id_fkey(*, school:schools(*))
    `)
    .eq('sport_id', sportRecord.id)
    .gte('game_date', twoWeeksAgo)
    .lte('game_date', twoWeeksAhead)
    .eq(activeSeason ? 'season_id' : 'id', activeSeason ? activeSeason.id : 'none')
    .order('game_date', { ascending: false });

  const games = (gamesData as GameWithTeams[]) || [];

  // Standings
  const { data: allGames } = await supabase
    .from('games')
    .select(`*, home_team:teams!games_home_team_id_fkey(*, school:schools(*)), away_team:teams!games_away_team_id_fkey(*, school:schools(*))`)
    .eq('sport_id', sportRecord.id)
    .eq('status', 'Final')
    .eq(activeSeason ? 'season_id' : 'id', activeSeason ? activeSeason.id : 'none');

  const standings = calculateStandings((allGames as GameWithTeams[]) || []);

  const recentGames = games.filter(g => g.status === 'Final');
  const upcomingGames = games.filter(g => g.status === 'Scheduled').reverse();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/" className="text-slate-400 hover:text-white text-sm">Home</Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 text-sm">{sport.name}</span>
        </div>
        <h1 className="text-3xl font-bold font-display text-white">{sport.name}</h1>
        {activeSeason && (
          <p className="text-slate-400 text-sm mt-1">{activeSeason.name}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main — scores */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming */}
          {upcomingGames.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Upcoming</h2>
              <div className="space-y-2">
                {upcomingGames.slice(0, 10).map(game => (
                  <ScoreCard key={game.id} game={game} compact />
                ))}
              </div>
            </section>
          )}

          {/* Recent Results */}
          {recentGames.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Results</h2>
              <div className="space-y-2">
                {recentGames.slice(0, 20).map(game => (
                  <ScoreCard key={game.id} game={game} compact />
                ))}
              </div>
            </section>
          )}

          {games.length === 0 && (
            <div className="card p-8 text-center text-slate-400">
              No games found for this sport in the active season.
            </div>
          )}
        </div>

        {/* Sidebar — standings */}
        <div>
          {standings.length > 0 && (
            <div className="card p-4">
              <h2 className="text-white font-bold flex items-center gap-2 mb-4">
                <Trophy size={16} className="text-yellow-400" /> Standings
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-white/10">
                      <th className="text-left pb-2 font-medium">Team</th>
                      <th className="text-center pb-2 font-medium">W</th>
                      <th className="text-center pb-2 font-medium">L</th>
                      <th className="text-center pb-2 font-medium">T</th>
                      <th className="text-center pb-2 font-medium">PCT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.slice(0, 16).map((row, i) => (
                      <tr key={row.team_id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-1.5 pr-2">
                          <span className="text-slate-500 mr-1.5">{i + 1}.</span>
                          <Link href={`/teams/${row.slug}`} className="text-white hover:text-ice transition-colors">
                            {row.team_name}
                          </Link>
                        </td>
                        <td className="text-center text-white font-mono">{row.wins}</td>
                        <td className="text-center text-white font-mono">{row.losses}</td>
                        <td className="text-center text-white font-mono">{row.ties}</td>
                        <td className="text-center text-slate-300 font-mono">{row.win_pct.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/standings" className="block text-center text-xs text-ice hover:underline mt-3">
                Full Standings →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
