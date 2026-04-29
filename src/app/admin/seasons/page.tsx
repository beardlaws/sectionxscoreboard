'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Season } from '@/types';
import { Plus, CheckCircle, ArrowRight, Loader } from 'lucide-react';

export default function AdminSeasonsPage() {
  const supabase = createClient();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    name: '',
    year: new Date().getFullYear(),
    season_type: 'Fall' as 'Spring' | 'Fall' | 'Winter',
    start_date: '',
    end_date: '',
    copy_from_season_id: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchSeasons(); }, []);

  async function fetchSeasons() {
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .order('year', { ascending: false })
      .order('season_type');
    setSeasons((data as Season[]) || []);
    setLoading(false);
  }

  async function setActive(id: string) {
    // Deactivate all seasons then activate the selected one
    const { data: allSeasons } = await supabase.from('seasons').select('id');
    for (const s of (allSeasons || [])) {
      await adminDb.update('seasons', { is_active: s.id === id }, { id: s.id });
    }
    fetchSeasons();
  }

  async function createSeason() {
    setCreating(true);
    const name = wizardData.name || `${wizardData.season_type} ${wizardData.year}`;

    // 1. Create season
    const { data: newSeason, error } = await supabase
      .from('seasons')
      .insert({
        name,
        year: wizardData.year,
        season_type: wizardData.season_type,
        is_active: false,
        start_date: wizardData.start_date || null,
        end_date: wizardData.end_date || null,
      })
      .select()
      .single();

    if (error || !newSeason) {
      alert('Error creating season: ' + error?.message);
      setCreating(false);
      return;
    }

    // 2. Copy team_seasons from prior season if selected
    if (wizardData.copy_from_season_id) {
      const { data: priorTeamSeasons } = await supabase
        .from('team_seasons')
        .select('*')
        .eq('season_id', wizardData.copy_from_season_id);

      if (priorTeamSeasons && priorTeamSeasons.length > 0) {
        const newTeamSeasons = priorTeamSeasons.map((ts: any) => ({
          team_id: ts.team_id,
          season_id: newSeason.id,
          class: ts.class,
          division: ts.division,
          active_for_season: ts.active_for_season,
          display_team_name: ts.display_team_name,
          is_coop: ts.is_coop,
          coop_schools: ts.coop_schools,
          notes: ts.notes,
        }));
        await adminDb.insert('team_seasons', newTeamSeasons);
      }
    }

    setCreating(false);
    setShowWizard(false);
    setWizardStep(1);
    fetchSeasons();
  }

  const matchingSeasons = seasons.filter(
    s => s.season_type === wizardData.season_type && s.year < wizardData.year
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-white">Season Manager</h1>
        <button
          onClick={() => setShowWizard(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Start New Season
        </button>
      </div>

      {/* New Season Wizard */}
      {showWizard && (
        <div className="card p-6 mb-6 border-ice/30">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-ice text-navy text-xs flex items-center justify-center font-bold">{wizardStep}</span>
            {wizardStep === 1 ? 'Season Details' : wizardStep === 2 ? 'Copy Teams?' : 'Confirm'}
          </h2>

          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Season Type</label>
                  <select
                    value={wizardData.season_type}
                    onChange={e => setWizardData({ ...wizardData, season_type: e.target.value as any })}
                    className="input w-full"
                  >
                    <option>Spring</option>
                    <option>Fall</option>
                    <option>Winter</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Year</label>
                  <input
                    type="number"
                    value={wizardData.year}
                    onChange={e => setWizardData({ ...wizardData, year: parseInt(e.target.value) })}
                    className="input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Custom Name (optional)</label>
                <input
                  type="text"
                  value={wizardData.name}
                  onChange={e => setWizardData({ ...wizardData, name: e.target.value })}
                  placeholder={`${wizardData.season_type} ${wizardData.year}`}
                  className="input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                  <input type="date" value={wizardData.start_date} onChange={e => setWizardData({ ...wizardData, start_date: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">End Date</label>
                  <input type="date" value={wizardData.end_date} onChange={e => setWizardData({ ...wizardData, end_date: e.target.value })} className="input w-full" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowWizard(false)} className="btn-secondary">Cancel</button>
                <button onClick={() => setWizardStep(2)} className="btn-primary flex items-center gap-1">Next <ArrowRight size={14} /></button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm">Copy team activations from a previous {wizardData.season_type} season?</p>
              {matchingSeasons.length > 0 ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setWizardData({ ...wizardData, copy_from_season_id: '' })}
                    className={`w-full p-3 rounded border text-left text-sm transition-colors ${
                      !wizardData.copy_from_season_id ? 'border-ice bg-ice/10 text-white' : 'border-white/20 text-slate-400 hover:border-white/40'
                    }`}
                  >
                    Start fresh — no team copy
                  </button>
                  {matchingSeasons.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setWizardData({ ...wizardData, copy_from_season_id: s.id })}
                      className={`w-full p-3 rounded border text-left text-sm transition-colors ${
                        wizardData.copy_from_season_id === s.id ? 'border-ice bg-ice/10 text-white' : 'border-white/20 text-slate-400 hover:border-white/40'
                      }`}
                    >
                      Copy from {s.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm italic">No previous {wizardData.season_type} seasons found.</p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setWizardStep(1)} className="btn-secondary">Back</button>
                <button onClick={() => setWizardStep(3)} className="btn-primary flex items-center gap-1">Next <ArrowRight size={14} /></button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="bg-white/5 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Season</span>
                  <span className="text-white font-medium">{wizardData.name || `${wizardData.season_type} ${wizardData.year}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Type</span>
                  <span className="text-white">{wizardData.season_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Year</span>
                  <span className="text-white">{wizardData.year}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Copy Teams</span>
                  <span className="text-white">
                    {wizardData.copy_from_season_id
                      ? seasons.find(s => s.id === wizardData.copy_from_season_id)?.name
                      : 'No'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500">This will NOT affect existing scores or standings. Historical data stays intact.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setWizardStep(2)} className="btn-secondary">Back</button>
                <button
                  onClick={createSeason}
                  disabled={creating}
                  className="btn-primary flex items-center gap-1"
                >
                  {creating ? <><Loader size={14} className="animate-spin" /> Creating...</> : <><CheckCircle size={14} /> Create Season</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Seasons List */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-3">
          {seasons.map(season => (
            <div key={season.id} className={`card p-4 flex items-center justify-between gap-4 ${season.is_active ? 'border-l-4 border-l-green-500' : ''}`}>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-bold">{season.name}</h3>
                  {season.is_active && <span className="badge badge-live text-xs">ACTIVE</span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {season.season_type} · {season.year}
                  {season.start_date && ` · ${new Date(season.start_date).toLocaleDateString()} – ${season.end_date ? new Date(season.end_date).toLocaleDateString() : 'TBD'}`}
                </p>
              </div>
              {!season.is_active && (
                <button
                  onClick={() => setActive(season.id)}
                  className="btn-secondary text-sm whitespace-nowrap"
                >
                  Set Active
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
