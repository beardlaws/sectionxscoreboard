'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { adminDb } from '@/lib/adminDb';
import { Trash2, Search, Filter, RefreshCw } from 'lucide-react';

export default function AdminGamesPage() {
  const supabase = createClient();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [sports, setSports] = useState<any[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('games')
      .select(`
        id, game_date, home_score, away_score, status, source, parser_confidence,
        sport:sports(sport_name),
        home_team:teams!games_home_team_id_fkey(team_name, school:schools(school_name)),
        away_team:teams!games_away_team_id_fkey(team_name, school:schools(school_name))
      `)
      .order('game_date', { ascending: false })
      .limit(200);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (sportFilter) query = query.eq('sport_id', sportFilter);

    const { data } = await query;
    setGames(data || []);
    setLoading(false);
  }, [statusFilter, sportFilter]);

  useEffect(() => {
    fetchGames();
    supabase.from('sports').select('id, sport_name').order('sport_name').then(({ data }) => setSports(data || []));
  }, [fetchGames]);

  async function deleteGame(id: string) {
    if (!confirm('Delete this game?')) return;
    setDeleting(id);
    await adminDb.delete('games', { id });
    setGames(prev => prev.filter(g => g.id !== id));
    setDeleting(null);
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} games?`)) return;
    setBulkDeleting(true);
    for (const id of selected) {
      await adminDb.delete('games', { id });
    }
    setGames(prev => prev.filter(g => !selected.has(g.id)));
    setSelected(new Set());
    setBulkDeleting(false);
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected(new Set(filtered.map(g => g.id)));
  }

  const filtered = games.filter(g => {
    if (!search) return true;
    const homeSchool = (g.home_team as any)?.school?.school_name?.toLowerCase() || '';
    const awaySchool = (g.away_team as any)?.school?.school_name?.toLowerCase() || '';
    const s = search.toLowerCase();
    return homeSchool.includes(s) || awaySchool.includes(s);
  });

  const statusColor: Record<string, string> = {
    Final: 'text-green-400',
    Scheduled: 'text-blue-400',
    Postponed: 'text-yellow-400',
    Canceled: 'text-red-400',
    Live: 'text-orange-400',
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold font-display text-white">Game Manager</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={bulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm font-medium transition-colors"
            >
              <Trash2 size={14} /> Delete {selected.size} selected
            </button>
          )}
          <button onClick={fetchGames} className="p-2 text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teams..." className="input w-full pl-8" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-full">
          <option value="">All statuses</option>
          <option>Final</option>
          <option>Scheduled</option>
          <option>Postponed</option>
          <option>Canceled</option>
        </select>
        <select value={sportFilter} onChange={e => setSportFilter(e.target.value)} className="input w-full">
          <option value="">All sports</option>
          {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500">{filtered.length} games</p>
        {filtered.length > 0 && (
          <button onClick={selectAllVisible} className="text-xs text-ice hover:underline">
            Select all visible
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No games found.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(game => {
            const home = (game.home_team as any)?.school?.school_name || (game.home_team as any)?.team_name || 'TBD';
            const away = (game.away_team as any)?.school?.school_name || (game.away_team as any)?.team_name || 'TBD';
            const sport = (game.sport as any)?.sport_name || '';
            const isSelected = selected.has(game.id);

            return (
              <div
                key={game.id}
                className={`card p-3 flex items-center gap-3 transition-colors ${isSelected ? 'border-red-500/30 bg-red-500/5' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(game.id)}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-medium truncate">{away} @ {home}</span>
                    {game.home_score != null && (
                      <span className="text-slate-300 text-sm font-mono">{game.away_score}–{game.home_score}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-slate-500 text-xs">{game.game_date}</span>
                    <span className="text-slate-500 text-xs">·</span>
                    <span className="text-slate-500 text-xs">{sport}</span>
                    <span className={`text-xs font-medium ${statusColor[game.status] || 'text-slate-400'}`}>{game.status}</span>
                    {game.parser_confidence === 'Low' && <span className="text-xs text-red-400">⚠ Low confidence</span>}
                  </div>
                </div>
                <button
                  onClick={() => deleteGame(game.id)}
                  disabled={deleting === game.id}
                  className="p-1.5 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  {deleting === game.id ? '...' : <Trash2 size={15} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
