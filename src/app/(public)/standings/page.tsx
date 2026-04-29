import { createClient } from '@/lib/supabase/server';
import { Metadata } from 'next';
import Link from 'next/link';
import { calculateStandings } from '@/lib/standings';
import { GameWithTeams } from '@/types';
import { Trophy } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Standings | Section X Scoreboard',
  description: 'Section X high school sports standings — East, Central, and West divisions.',
};

export const revalidate = 60;

interface Props { searchParams: { sport?: string } }

const DIVISION_ORDER = ['East', 'Central', 'West', 'Overall']

export default async function StandingsPage({ searchParams }: Props) {
  const supabase = createClient();

  const { data: activeSeason } = await supabase.from('seasons').select('*').eq('is_active', true).single();
  const seasonId = activeSeason?.id;

  // Sports that have final games this season
  const { data: gamesForSports } = await supabase
    .from('games')
    .select('sport_id, sport:sports(id, sport_name, slug, gender)')
    .eq('season_id', seasonId || '')
    .eq('status', 'Final');

  const uniqueSports: any[] = Object.values(
    ((gamesForSports || []) as any[]).reduce((acc: any, g: any) => {
      if (g.sport) acc[g.sport_id] = g.sport;
      return acc;
    }, {})
  );
  uniqueSports.sort((a, b) => a.sport_name.localeCompare(b.sport_name));

  const selectedSlug = searchParams.sport || uniqueSports[0]?.slug;
  const selectedSport = uniqueSports.find(s => s.slug === selectedSlug) || uniqueSports[0];

  let standings: any[] = [];
  if (selectedSport && seasonId) {
    // Get games and team_seasons in parallel
    const [{ data: gamesData }, { data: teamSeasonsData }] = await Promise.all([
      supabase
        .from('games')
        .select(`*, home_team:teams!games_home_team_id_fkey(*, school:schools(*)), away_team:teams!games_away_team_id_fkey(*, school:schools(*))`)
        .eq('sport_id', selectedSport.id)
        .eq('season_id', seasonId)
        .eq('status', 'Final'),
      supabase
        .from('team_seasons')
        .select('team_id, division, class')
        .eq('season_id', seasonId),
    ]);
    standings = calculateStandings((gamesData as GameWithTeams[]) || [], teamSeasonsData || []);
  }

  // Group by division in defined order
  const byDivision: Record<string, any[]> = {};
  for (const row of standings) {
    const div = row.division || 'Overall';
    if (!byDivision[div]) byDivision[div] = [];
    byDivision[div].push(row);
  }

  const divisionKeys = [
    ...DIVISION_ORDER.filter(d => byDivision[d]),
    ...Object.keys(byDivision).filter(d => !DIVISION_ORDER.includes(d)),
  ];

  const StandingsTable = ({ rows, title }: { rows: any[]; title?: string }) => (
    <div className="card overflow-hidden mb-5">
      {title && (
        <div className="px-4 py-2.5 border-b border-white/10" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <h3 className="text-white font-bold text-sm font-display uppercase tracking-wide">{title} Division</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-white/10">
              <th className="text-left px-4 py-2.5 font-medium">Team</th>
              <th className="text-center px-3 py-2.5 font-medium">W</th>
              <th className="text-center px-3 py-2.5 font-medium">L</th>
              <th className="text-center px-3 py-2.5 font-medium hidden sm:table-cell">PCT</th>
              <th className="text-center px-3 py-2.5 font-medium hidden md:table-cell">PF</th>
              <th className="text-center px-3 py-2.5 font-medium hidden md:table-cell">PA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.team_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 text-xs w-4">{i + 1}</span>
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: row.primary_color || '#334155' }} />
                    <Link href={`/teams/${row.slug}`} className="text-white hover:text-ice transition-colors text-sm font-medium">
                      {row.school_name || row.team_name}
                    </Link>
                    {row.class && <span className="text-slate-600 text-xs">({row.class})</span>}
                  </div>
                </td>
                <td className="text-center px-3 py-2.5 text-white font-mono font-bold">{row.wins}</td>
                <td className="text-center px-3 py-2.5 text-white font-mono">{row.losses}</td>
                <td className="text-center px-3 py-2.5 text-slate-300 font-mono text-sm hidden sm:table-cell">{row.win_pct.toFixed(3)}</td>
                <td className="text-center px-3 py-2.5 text-slate-400 font-mono text-xs hidden md:table-cell">{row.points_for}</td>
                <td className="text-center px-3 py-2.5 text-slate-400 font-mono text-xs hidden md:table-cell">{row.points_against}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Trophy size={24} className="text-yellow-400" />
        <h1 className="text-2xl font-bold font-display text-white">Standings</h1>
      </div>
      {activeSeason && <p className="text-slate-400 text-sm mb-6 ml-9">{activeSeason.name}</p>}

      {/* Sport tabs */}
      {uniqueSports.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {uniqueSports.map((s: any) => (
            <Link key={s.slug} href={`/standings?sport=${s.slug}`}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                s.slug === selectedSlug ? 'bg-ice text-navy' : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}>
              {s.sport_name}
            </Link>
          ))}
        </div>
      )}

      {standings.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          <p className="text-3xl mb-3">🏆</p>
          <p>No standings yet for {selectedSport?.sport_name}.</p>
          <p className="text-sm mt-1">Standings calculate automatically once Final scores are entered.</p>
        </div>
      ) : divisionKeys.length > 1 ? (
        divisionKeys.map(div => (
          <StandingsTable key={div} rows={byDivision[div]} title={div} />
        ))
      ) : (
        <StandingsTable rows={standings} />
      )}
    </div>
  );
}
