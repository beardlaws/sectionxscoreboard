'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CorrectionRequest } from '@/types';
import { Check, ExternalLink, Trash2 } from 'lucide-react';

export default function AdminCorrectionsPage() {
  const supabase = createClient();
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');

  useEffect(() => { fetchCorrections(); }, [filter]);

  async function fetchCorrections() {
    setLoading(true);
    let query = supabase
      .from('correction_requests')
      .select('*, game:games(id, game_date, sport:sports(sport_name), home_team:teams!games_home_team_id_fkey(team_name), away_team:teams!games_away_team_id_fkey(team_name))')
      .order('created_at', { ascending: false });

    if (filter === 'open') query = query.eq('status', 'open');
    if (filter === 'resolved') query = query.eq('status', 'resolved');

    const { data } = await query;
    setCorrections((data as CorrectionRequest[]) || []);
    setLoading(false);
  }

  async function resolve(id: string) {
    await supabase.from('correction_requests').update({ status: 'resolved' }).eq('id', id);
    fetchCorrections();
  }

  async function dismiss(id: string) {
    await supabase.from('correction_requests').update({ status: 'dismissed' }).eq('id', id);
    fetchCorrections();
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-white">Correction Requests</h1>
        <div className="flex gap-2">
          {(['open', 'resolved', 'all'] as const).map(f => (
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
      ) : corrections.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">✅</p>
          <p>No {filter === 'all' ? '' : filter} correction requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {corrections.map(c => {
            const game = (c as any).game;
            return (
              <div key={c.id} className={`card p-4 border-l-4 ${
                c.status === 'open' ? 'border-l-yellow-500' : 'border-l-green-500'
              }`}>
                {game && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-slate-400">
                      {game.sport?.sport_name} · {new Date(game.game_date).toLocaleDateString()} ·{' '}
                      {game.away_team?.team_name} vs {game.home_team?.team_name}
                    </span>
                    <a
                      href={`/games/${game.id}`}
                      target="_blank"
                      className="text-ice hover:underline text-xs flex items-center gap-0.5"
                    >
                      View <ExternalLink size={10} />
                    </a>
                  </div>
                )}
                <p className="text-white text-sm mb-3">{c.correction_text}</p>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {c.submitter_name} · {c.submitter_email} · {new Date(c.created_at).toLocaleDateString()}
                  </div>
                  {c.status === 'open' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolve(c.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs font-medium transition-colors"
                      >
                        <Check size={12} /> Resolve
                      </button>
                      <button
                        onClick={() => dismiss(c.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-400 rounded text-xs font-medium transition-colors"
                      >
                        <Trash2 size={12} /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
