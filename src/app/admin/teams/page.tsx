'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { adminDb } from '@/lib/adminDb';
import { Team, Season } from '@/types';
import { Search, ToggleLeft, ToggleRight } from 'lucide-react';

export default function AdminTeamsPage() {
  const supabase = createClient();
  const [teams, setTeams] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('');

  useEffect(() => {
    async function init() {
      const [{ data: s }, { data: activeSeason }] = await Promise.all([
        supabase.from('seasons').select('*').order('year', { ascending: false }),
        supabase.from('seasons').select('*').eq('is_active', true).single(),
      ]);
      setSeasons((s as Season[]) || []);
      if (activeSeason) setSelectedSeason(activeSeason.id);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (selectedSeason) fetchTeams();
  }, [selectedSeason]);

  async function fetchTeams() {
    const { data } = await supabase
      .from('teams')
      .select(`
        *,
        school:schools(school_name, primary_color, city),
        sport:sports(sport_name, gender, season_type),
        team_seasons!left(id, active_for_season, class, division, season_id)
      `)
      .order('school_id')
      .order('sport_id');

    // Filter team_seasons to just the selected season
    const processed = (data || []).map((t: any) => ({
      ...t,
      current_season: t.team_seasons?.find((ts: any) => ts.season_id === selectedSeason) || null,
    }));
    setTeams(processed);
  }

  async function toggleTeamSeason(team: any) {
    const existing = team.current_season;
    if (existing) {
      await adminDb.update('team_seasons', { active_for_season: !existing.active_for_season }, { id: existing.id });
    } else {
      await adminDb.insert('team_seasons', { team_id: team.id, season_id: selectedSeason, active_for_season: true });
    }
    fetchTeams();
  }

  const sports = [...new Set(teams.map(t => t.sport?.sport_name).filter(Boolean))].sort();

  const filtered = teams.filter(t => {
    const matchSearch = !search ||
      t.school?.school_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.sport?.sport_name?.toLowerCase().includes(search.toLowerCase());
    const matchSport = !sportFilter || t.sport?.sport_name === sportFilter;
    return matchSearch && matchSport;
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-white">Team Manager</h1>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Season</label>
          <select
            value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
            className="input w-full"
          >
            {seasons.map(s => (
              <option key={s.id} value={s.id}>{s.name} {s.is_active ? '(Active)' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Sport</label>
          <select value={sportFilter} onChange={e => setSportFilter(e.target.value)} className="input w-full">
            <option value="">All Sports</option>
            {sports.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="School or sport..."
              className="input w-full pl-8"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-3">{filtered.length} teams · Toggle to activate/deactivate for selected season</p>
          <div className="space-y-2">
            {filtered.map(team => {
              const isActive = team.current_season?.active_for_season ?? false;
              const hasEntry = !!team.current_season;
              return (
                <div key={team.id} className={`card p-3 flex items-center justify-between gap-4 transition-opacity ${!isActive && hasEntry ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 text-white text-xs flex items-center justify-center font-bold"
                      style={{ backgroundColor: team.school?.primary_color || '#334155' }}
                    >
                      {team.school?.school_name?.[0]}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{team.school?.school_name}</p>
                      <p className="text-xs text-slate-400">
                        {team.sport?.gender === 'Boys' ? '♂' : team.sport?.gender === 'Girls' ? '♀' : ''} {team.sport?.sport_name}
                        {team.current_season?.class && ` · Class ${team.current_season.class}`}
                        {team.current_season?.division && ` · ${team.current_season.division}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleTeamSeason(team)}
                    className={`flex items-center gap-1 text-sm transition-colors ${
                      isActive ? 'text-green-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    <span className="text-xs hidden sm:inline">{isActive ? 'Active' : hasEntry ? 'Inactive' : 'Not Added'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
