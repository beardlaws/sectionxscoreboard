'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { adminDb } from '@/lib/adminDb';
import { Shoutout } from '@/types';
import { Check, Trash2, Star } from 'lucide-react';

const SHOUTOUT_TYPE_LABELS: Record<string, string> = {
  player_of_game: '🏆 Player of the Game',
  big_play: '⚡ Big Play',
  clutch_moment: '🎯 Clutch Moment',
  milestone: '🏅 Milestone',
  senior_night: '🎓 Senior Night',
  first_varsity_hit: '⚾ First Varsity Hit',
  first_varsity_goal: '⚽ First Varsity Goal',
  no_hitter: '🔥 No-Hitter',
  hat_trick: '🎩 Hat Trick',
  walk_off_win: '🎉 Walk-Off Win',
};

export default function AdminShoutoutsPage() {
  const supabase = createClient();
  const [shoutouts, setShoutouts] = useState<Shoutout[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending');

  useEffect(() => { fetchShoutouts(); }, [filter]);

  async function fetchShoutouts() {
    setLoading(true);
    let query = supabase
      .from('shoutouts')
      .select('*, school:schools(school_name)')
      .order('created_at', { ascending: false });

    if (filter === 'pending') query = query.eq('approved', false);
    if (filter === 'approved') query = query.eq('approved', true);

    const { data } = await query;
    setShoutouts((data as Shoutout[]) || []);
    setLoading(false);
  }

  async function approve(id: string) {
    await adminDb.update('shoutouts', { approved: true }, { id });
    fetchShoutouts();
  }

  async function remove(id: string) {
    await adminDb.delete('shoutouts', { id });
    fetchShoutouts();
  }

  async function feature(id: string, featured: boolean) {
    await adminDb.update('shoutouts', { featured }, { id });
    fetchShoutouts();
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-white">Shoutout Queue</h1>
        <div className="flex gap-2">
          {(['pending', 'approved', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-ice text-navy' : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading...</div>
      ) : shoutouts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">🏆</p>
          <p>No {filter === 'all' ? '' : filter} shoutouts</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shoutouts.map(s => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="badge bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                      {SHOUTOUT_TYPE_LABELS[s.shoutout_type] || s.shoutout_type}
                    </span>
                    {s.featured && <span className="badge badge-live text-xs">⭐ Featured</span>}
                    {s.approved && <span className="badge bg-green-500/20 text-green-400 border-green-500/30 text-xs">Approved</span>}
                  </div>
                  {s.athlete_name && (
                    <p className="text-white font-bold text-lg mb-1">{s.athlete_name}</p>
                  )}
                  <p className="text-slate-300 text-sm mb-3">{s.description}</p>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span>From: {s.submitter_name}</span>
                    {s.submitter_email && <span>{s.submitter_email}</span>}
                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                {!s.approved && (
                  <button
                    onClick={() => approve(s.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-sm font-medium transition-colors"
                  >
                    <Check size={14} /> Approve
                  </button>
                )}
                <button
                  onClick={() => feature(s.id, !s.featured)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    s.featured ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-slate-400 hover:bg-white/20'
                  }`}
                >
                  <Star size={14} /> {s.featured ? 'Unfeature' : 'Feature'}
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm font-medium transition-colors ml-auto"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
