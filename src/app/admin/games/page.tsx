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
  const [updatingLeague, setUpdatingLeague] = useState<string | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<any>({});
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('games')
      .select(`
        id, game_date, game_time, location, home_team_id, away_team_id, sport_id, home_score, away_score, status, source, parser_confidence, contest_type, league_designation, league_designation_override, league_designation_note, schedule_override, schedule_override_note,
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
    supabase.from('teams').select('id, sport_id, team_name, school:schools(school_name)').eq('active', true).order('team_name').then(({ data }) => setTeams(data || []));
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

  async function setLeagueDesignation(id: string, designation: string) {
    setUpdatingLeague(id);
    try {
      const res = await fetch('/api/admin/games/league-designation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gameId: id,
          designation: designation === 'Auto' ? null : designation,
          note: designation === 'Auto' ? '' : 'Set manually in Game Manager',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not update league designation.');
      setGames(prev => prev.map(g => g.id === id ? {
        ...g,
        league_designation: data.game.league_designation,
        league_designation_override: data.game.league_designation_override,
        league_designation_note: data.game.league_designation_note,
      } : g));
    } catch (error: any) {
      alert(error?.message || 'Could not update league designation.');
    } finally {
      setUpdatingLeague(null);
    }
  }

  function startScheduleEdit(game: any) {
    setEditingSchedule(game.id);
    setScheduleDraft({
      gameDate: game.game_date || '',
      gameTime: game.game_time ? String(game.game_time).slice(0,5) : '',
      location: game.location || '',
      homeTeamId: game.home_team_id || '',
      awayTeamId: game.away_team_id || '',
    });
  }

  async function saveScheduleOverride(game: any) {
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/admin/games/schedule-override', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          mode: 'lock',
          ...scheduleDraft,
          note: 'Set manually in Game Manager',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not save schedule override.');
      setEditingSchedule(null);
      await fetchGames();
    } catch (error: any) {
      alert(error?.message || 'Could not save schedule override.');
    } finally {
      setSavingSchedule(false);
    }
  }

  async function restoreScheduleAuto(game: any) {
    if (!confirm('Remove the manual schedule lock? Arbiter will be allowed to update this game again.')) return;
    setSavingSchedule(true);
    try {
      const res = await fetch('/api/admin/games/schedule-override', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, mode: 'auto' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not restore automatic schedule syncing.');
      setEditingSchedule(null);
      await fetchGames();
    } catch (error: any) {
      alert(error?.message || 'Could not restore automatic syncing.');
    } finally {
      setSavingSchedule(false);
    }
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
                    <span className="text-slate-500 text-xs">{game.game_date}{game.game_time ? ' · ' + String(game.game_time).slice(0,5) : ''}</span>
                    <span className="text-slate-500 text-xs">·</span>
                    <span className="text-slate-500 text-xs">{sport}</span>
                    {game.contest_type === 'Scrimmage' && <span className="text-xs text-amber-300">Scrimmage</span>}
                    {game.league_designation && (
                      <span className={`text-xs font-bold ${game.league_designation === 'League' ? 'text-emerald-300' : 'text-slate-400'}`}>
                        {game.league_designation}{game.league_designation_override ? ' · manual' : ' · Arbiter'}
                      </span>
                    )}
                    {game.schedule_override && <span className="text-xs font-bold text-amber-300">Schedule · manual</span>}
                    <span className={`text-xs font-medium ${statusColor[game.status] || 'text-slate-400'}`}>{game.status}</span>
                    {game.parser_confidence === 'Low' && <span className="text-xs text-red-400">⚠ Low confidence</span>}
                  </div>
                </div>
                <button onClick={() => startScheduleEdit(game)} className="px-2.5 py-1.5 rounded text-xs font-bold text-blue-300 border border-blue-400/20 bg-blue-400/5 hover:bg-blue-400/10">Edit schedule</button>
                {game.contest_type !== 'Scrimmage' && (
                  <select
                    value={game.league_designation_override ? (game.league_designation || 'Auto') : 'Auto'}
                    onChange={e => setLeagueDesignation(game.id, e.target.value)}
                    disabled={updatingLeague === game.id}
                    className="input text-xs py-1.5 w-[112px] flex-shrink-0"
                    title={game.league_designation_override ? (game.league_designation_note || 'Manual override') : (game.league_designation ? `Arbiter: ${game.league_designation}` : 'Automatic / inferred')}
                  >
                    <option value="Auto">Auto</option>
                    <option value="League">League</option>
                    <option value="Non-League">Non-League</option>
                  </select>
                )}
                <button
                  onClick={() => deleteGame(game.id)}
                  disabled={deleting === game.id}
                  className="p-1.5 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  {deleting === game.id ? '...' : <Trash2 size={15} />}
                </button>
                {editingSchedule === game.id && (
                  <div className="w-full basis-full mt-2 rounded-xl border border-white/10 bg-black/30 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    <label className="text-xs text-slate-400">Date
                      <input type="date" value={scheduleDraft.gameDate || ''} onChange={e => setScheduleDraft((d:any)=>({...d,gameDate:e.target.value}))} className="input w-full mt-1" />
                    </label>
                    <label className="text-xs text-slate-400">Time
                      <input type="time" value={scheduleDraft.gameTime || ''} onChange={e => setScheduleDraft((d:any)=>({...d,gameTime:e.target.value}))} className="input w-full mt-1" />
                    </label>
                    <label className="text-xs text-slate-400">Home
                      <select value={scheduleDraft.homeTeamId || ''} onChange={e => setScheduleDraft((d:any)=>({...d,homeTeamId:e.target.value}))} className="input w-full mt-1">
                        <option value="">TBD</option>
                        {teams.filter(t=>t.sport_id===game.sport_id).map(t=><option key={t.id} value={t.id}>{(t.school as any)?.school_name || t.team_name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-slate-400">Away
                      <select value={scheduleDraft.awayTeamId || ''} onChange={e => setScheduleDraft((d:any)=>({...d,awayTeamId:e.target.value}))} className="input w-full mt-1">
                        <option value="">TBD</option>
                        {teams.filter(t=>t.sport_id===game.sport_id).map(t=><option key={t.id} value={t.id}>{(t.school as any)?.school_name || t.team_name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-slate-400">Location
                      <input value={scheduleDraft.location || ''} onChange={e => setScheduleDraft((d:any)=>({...d,location:e.target.value}))} className="input w-full mt-1" />
                    </label>
                    <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap gap-2 pt-1">
                      <button onClick={() => saveScheduleOverride(game)} disabled={savingSchedule} className="px-3 py-2 rounded text-xs font-black bg-blue-500/20 text-blue-200 border border-blue-400/25">{savingSchedule ? 'Saving…' : 'Save & lock schedule'}</button>
                      {game.schedule_override && <button onClick={() => restoreScheduleAuto(game)} disabled={savingSchedule} className="px-3 py-2 rounded text-xs font-bold bg-amber-500/10 text-amber-200 border border-amber-400/20">Return to Arbiter auto-sync</button>}
                      <button onClick={() => setEditingSchedule(null)} className="px-3 py-2 rounded text-xs font-bold text-slate-400">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
