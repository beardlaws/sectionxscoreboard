import { createClient } from '@/lib/supabase/server';
import { Metadata } from 'next';
import Link from 'next/link';
import { calculateStandings } from '@/lib/standings';
import { GameWithTeams } from '@/types';
import { Trophy } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Standings | Section X Scoreboard',
  description: 'Section X high school sports standings for all sports. Northern NY.',
};

interface Props {
  searchParams: { sport?: string; season?: string };
}

export default async function StandingsPage({ searchParams }: Props) {
  const supabase = createClient();

  const [{ data: activeSeason }, { data: sports }] = await Promise.all([
    supabase.from('seasons').select('*').eq('is_active', true).single(),
    supabase.from('sports').select('*').eq('active_public', true).order('sport_name'),
  ]);

  const seasonId = activeSeason?.id;

  // Get all sports that have games this season
  const { data: sportsWithGames } = await supabase
    .from('games')
    .select('sport_id, sport:sports(id, sport_name, slug, gender)')
    .eq(seasonId ? 'season_id' : 'id', seasonId || 'none')
    .eq('status', 'Final');

  const uniqueSports = Object.values(
    ((sportsWithGames || []) as any[]).reduce((acc: any, g: any) => {
      if (g.sport) acc[g.sport_id] = g.sport;
      return acc;
    }, {})
  ) as any[];

  uniqueSports.sort((a, b) => a.sport_name.localeCompare(b.sport_name));

  const selectedSportSlug = searchParams.sport || uniqueSports[0]?.slug;
  const selectedSport = uniqueSports.find(s => s.slug === selectedSportSlug) || uniqueSports[0];

  let standings: any[] = [];
  if (selectedSport && seasonId) {
    const { data: gamesData } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(*, school:schools(*)),
        away_team:teams!games_away_team_id_fkey(*, school:schools(*))
      `)
      .eq('sport_id', selectedSport.id)
      .eq('season_id', seasonId)
      .eq('status', 'Final');

    standings = calculateStandings((gamesData as GameWithTeams[]) || []);
  }

  // Group standings by division if available
  const divisionGroups = standings.reduce((acc: any, row: any) => {
    const div = row.division || 'Overall';
    if (!acc[div]) acc[div] = [];
    acc[div].push(row);
    return acc;
  }, {});

  const StandingsTable = ({ rows, title }: { rows: any[]; title?: string }) => (
    <div className="card overflow-hidden mb-4">
      {title && (
        <div className="px-4 py-2 bg-white/5 border-b border-white/10">
          <h3 className="text-white font-bold text-sm">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-white/10">
              <th className="text-left px-4 py-3 font-medium">Team</th>
              <th className="text-center px-3 py-3 font-medium">W</th>
              <th className="text-center px-3 py-3 font-medium">L</th>
              <th className="text-center px-3 py-3 font-medium">T</th>
              <th className="text-center px-3 py-3 font-medium">PCT</th>
              <th className="text-center px-3 py-3 font-medium hidden sm:table-cell">PF</th>
              <th className="text-center px-3 py-3 font-medium hidden sm:table-cell">PA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.team_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs w-4">{i + 1}</span>
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: row.primary_color || '#334155' }}
                    />
                    <Link href={`/teams/${row.slug}`} className="text-white hover:text-ice transition-colors text-sm font-medium">
                      {row.team_name}
                    </Link>
                  </div>
                </td>
                <td className="text-center px-3 py-3 text-white font-mono font-bold">{row.wins}</td>
                <td className="text-center px-3 py-3 text-white font-mono">{row.losses}</td>
                <td className="text-center px-3 py-3 text-white font-mono">{row.ties}</td>
                <td className="text-center px-3 py-3 text-slate-300 font-mono">{row.win_pct.toFixed(3)}</td>
                <td className="text-center px-3 py-3 text-slate-400 font-mono text-xs hidden sm:table-cell">{row.points_for}</td>
                <td className="text-center px-3 py-3 text-slate-400 font-mono text-xs hidden sm:table-cell">{row.points_against}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Trophy size={24} className="text-yellow-400" />
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Standings</h1>
          {activeSeason && <p className="text-slate-400 text-sm">{activeSeason.name}</p>}
        </div>
      </div>

      {/* Sport tabs */}
      {uniqueSports.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {uniqueSports.map((s: any) => (
            <Link
              key={s.slug}
              href={`/standings?sport=${s.slug}`}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                s.slug === selectedSportSlug
                  ? 'bg-ice text-navy'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {s.gender !== 'Both' && s.gender !== 'Mixed' ? `${s.gender === 'Boys' ? '♂' : '♀'} ` : ''}{s.sport_name}
            </Link>
          ))}
        </div>
      )}

      {standings.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          <p className="text-3xl mb-3">🏆</p>
          <p>No standings data yet for {selectedSport?.sport_name}.</p>
          <p className="text-sm mt-1">Standings calculate automatically from final scores.</p>
        </div>
      ) : Object.keys(divisionGroups).length > 1 ? (
        Object.entries(divisionGroups).map(([div, rows]) => (
          <StandingsTable key={div} rows={rows as any[]} title={div} />
        ))
      ) : (
        <StandingsTable rows={standings} />
      )}
    </div>
  );
}
