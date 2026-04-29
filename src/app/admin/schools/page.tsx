'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { School } from '@/types';
import { Plus, Edit2, Save, X } from 'lucide-react';

const emptySchool = {
  school_name: '',
  mascot: '',
  city: '',
  county: '',
  primary_color: '#1e3a5f',
  secondary_color: '#ffffff',
  alias: '',
  slug: '',
  active: true,
};

export default function AdminSchoolsPage() {
  const supabase = createClient();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<School>>({});
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState({ ...emptySchool });

  useEffect(() => { fetchSchools(); }, []);

  async function fetchSchools() {
    const { data } = await supabase.from('schools').select('*').order('school_name');
    setSchools((data as School[]) || []);
    setLoading(false);
  }

  function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  async function saveEdit(id: string) {
    await adminDb.update('schools', editData, { id });
    setEditingId(null);
    fetchSchools();
  }

  async function saveNew() {
    const slug = newData.slug || slugify(newData.school_name);
    await adminDb.insert('schools', { ...newData, slug });
    setAdding(false);
    setNewData({ ...emptySchool });
    fetchSchools();
  }

  async function toggleActive(id: string, active: boolean) {
    await adminDb.update('schools', { active }, { id });
    fetchSchools();
  }

  const SchoolRow = ({ school }: { school: School }) => {
    const isEditing = editingId === school.id;
    return (
      <div className={`card p-4 ${!school.active ? 'opacity-50' : ''}`}>
        {isEditing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">School Name</label>
                <input value={editData.school_name || ''} onChange={e => setEditData({ ...editData, school_name: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Mascot</label>
                <input value={editData.mascot || ''} onChange={e => setEditData({ ...editData, mascot: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">City</label>
                <input value={editData.city || ''} onChange={e => setEditData({ ...editData, city: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">County</label>
                <input value={editData.county || ''} onChange={e => setEditData({ ...editData, county: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Alias</label>
                <input value={editData.alias || ''} onChange={e => setEditData({ ...editData, alias: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Slug</label>
                <input value={editData.slug || ''} onChange={e => setEditData({ ...editData, slug: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Primary Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={editData.primary_color || '#000'} onChange={e => setEditData({ ...editData, primary_color: e.target.value })} className="w-10 h-9 rounded cursor-pointer bg-transparent border-0" />
                  <input value={editData.primary_color || ''} onChange={e => setEditData({ ...editData, primary_color: e.target.value })} className="input flex-1" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Secondary Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={editData.secondary_color || '#fff'} onChange={e => setEditData({ ...editData, secondary_color: e.target.value })} className="w-10 h-9 rounded cursor-pointer bg-transparent border-0" />
                  <input value={editData.secondary_color || ''} onChange={e => setEditData({ ...editData, secondary_color: e.target.value })} className="input flex-1" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingId(null)} className="btn-secondary flex items-center gap-1"><X size={14} /> Cancel</button>
              <button onClick={() => saveEdit(school.id)} className="btn-primary flex items-center gap-1"><Save size={14} /> Save</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: school.primary_color || '#1e3a5f' }} />
              <div>
                <p className="text-white font-medium">{school.school_name}</p>
                <p className="text-xs text-slate-400">{school.city}, {school.county} · {school.mascot} · <span className="font-mono">{school.alias}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleActive(school.id, !school.active)}
                className={`text-xs px-2 py-1 rounded transition-colors ${school.active ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-slate-400'}`}
              >
                {school.active ? 'Active' : 'Inactive'}
              </button>
              <button
                onClick={() => { setEditingId(school.id); setEditData({ ...school }); }}
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
              >
                <Edit2 size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-white">Schools</h1>
        <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add School
        </button>
      </div>

      {adding && (
        <div className="card p-4 mb-4 border-ice/30">
          <h3 className="text-white font-bold mb-3">New School</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {(['school_name', 'mascot', 'city', 'county', 'alias'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs text-slate-400 mb-1 capitalize">{field.replace('_', ' ')}</label>
                <input
                  value={(newData as any)[field]}
                  onChange={e => setNewData({ ...newData, [field]: e.target.value })}
                  className="input w-full"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveNew} className="btn-primary">Add School</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-2">
          {schools.map(school => <SchoolRow key={school.id} school={school} />)}
        </div>
      )}
    </div>
  );
}
