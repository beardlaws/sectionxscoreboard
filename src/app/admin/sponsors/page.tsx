'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Sponsor } from '@/types';
import { Plus, Edit2, Save, X, Trash2 } from 'lucide-react';

const PLACEMENTS = [
  'homepage', 'tonight_scores', 'spring_scoreboard', 'baseball', 'softball',
  'boys_lacrosse', 'girls_lacrosse', 'school_page', 'game_of_night',
  'photo_of_week', 'weekly_recap',
];

const PLACEMENT_LABELS: Record<string, string> = {
  homepage: 'Homepage',
  tonight_scores: "Tonight's Scores",
  spring_scoreboard: 'Spring Scoreboard',
  baseball: 'Baseball',
  softball: 'Softball',
  boys_lacrosse: 'Boys Lacrosse',
  girls_lacrosse: 'Girls Lacrosse',
  school_page: 'School Page',
  game_of_night: 'Game of the Night',
  photo_of_week: 'Photo of the Week',
  weekly_recap: 'Weekly Recap',
};

const empty = {
  business_name: '',
  contact_name: '',
  contact_email: '',
  website_url: '',
  logo_url: '',
  tagline: '',
  placement: 'homepage',
  active: true,
};

export default function AdminSponsorsPage() {
  const supabase = createClient();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Sponsor>>({});
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState({ ...empty });

  useEffect(() => { fetchSponsors(); }, []);

  async function fetchSponsors() {
    const { data } = await supabase.from('sponsors').select('*').order('placement').order('business_name');
    setSponsors((data as Sponsor[]) || []);
    setLoading(false);
  }

  async function saveEdit(id: string) {
    await supabase.from('sponsors').update(editData).eq('id', id);
    setEditingId(null);
    fetchSponsors();
  }

  async function addSponsor() {
    await supabase.from('sponsors').insert(newData);
    setAdding(false);
    setNewData({ ...empty });
    fetchSponsors();
  }

  async function deleteSponsor(id: string) {
    if (!confirm('Delete this sponsor?')) return;
    await supabase.from('sponsors').delete().eq('id', id);
    fetchSponsors();
  }

  const FormFields = ({ data, onChange }: { data: any; onChange: (d: any) => void }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[
        { key: 'business_name', label: 'Business Name' },
        { key: 'contact_name', label: 'Contact Name' },
        { key: 'contact_email', label: 'Contact Email' },
        { key: 'website_url', label: 'Website URL' },
        { key: 'logo_url', label: 'Logo URL' },
        { key: 'tagline', label: 'Tagline' },
      ].map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs text-slate-400 mb-1">{label}</label>
          <input
            value={data[key] || ''}
            onChange={e => onChange({ ...data, [key]: e.target.value })}
            className="input w-full"
          />
        </div>
      ))}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Placement</label>
        <select
          value={data.placement || 'homepage'}
          onChange={e => onChange({ ...data, placement: e.target.value })}
          className="input w-full"
        >
          {PLACEMENTS.map(p => <option key={p} value={p}>{PLACEMENT_LABELS[p]}</option>)}
        </select>
      </div>
    </div>
  );

  const grouped = PLACEMENTS.reduce((acc, p) => {
    acc[p] = sponsors.filter(s => s.placement === p);
    return acc;
  }, {} as Record<string, Sponsor[]>);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-white">Sponsors</h1>
        <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Sponsor
        </button>
      </div>

      {adding && (
        <div className="card p-4 mb-6 border-ice/30">
          <h3 className="text-white font-bold mb-3">New Sponsor</h3>
          <FormFields data={newData} onChange={setNewData} />
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setAdding(false)} className="btn-secondary">Cancel</button>
            <button onClick={addSponsor} className="btn-primary">Add</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          {PLACEMENTS.map(placement => {
            const placementSponsors = grouped[placement] || [];
            return (
              <div key={placement}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-slate-300 font-medium text-sm">{PLACEMENT_LABELS[placement]}</h2>
                  <div className="flex-1 h-px bg-white/10" />
                  {placementSponsors.length === 0 && (
                    <span className="text-xs text-slate-600 italic">open</span>
                  )}
                </div>
                {placementSponsors.map(sponsor => (
                  <div key={sponsor.id} className="card p-4 mb-2">
                    {editingId === sponsor.id ? (
                      <>
                        <FormFields data={editData} onChange={setEditData} />
                        <div className="flex gap-2 justify-end mt-3">
                          <button onClick={() => setEditingId(null)} className="btn-secondary flex items-center gap-1"><X size={14} /> Cancel</button>
                          <button onClick={() => saveEdit(sponsor.id)} className="btn-primary flex items-center gap-1"><Save size={14} /> Save</button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-white font-medium">{sponsor.business_name}</p>
                          {sponsor.tagline && <p className="text-xs text-slate-400">{sponsor.tagline}</p>}
                          {sponsor.website_url && (
                            <a href={sponsor.website_url} target="_blank" className="text-xs text-ice hover:underline">{sponsor.website_url}</a>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingId(sponsor.id); setEditData({ ...sponsor }); }} className="p-1.5 text-slate-400 hover:text-white"><Edit2 size={14} /></button>
                          <button onClick={() => deleteSponsor(sponsor.id)} className="p-1.5 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
