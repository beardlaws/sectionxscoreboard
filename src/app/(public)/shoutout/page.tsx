'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, CheckCircle } from 'lucide-react';

const SHOUTOUT_TYPES = [
  { value: 'player_of_game', label: '🏆 Player of the Game' },
  { value: 'big_play', label: '⚡ Big Play' },
  { value: 'clutch_moment', label: '🎯 Clutch Moment' },
  { value: 'milestone', label: '🏅 Milestone' },
  { value: 'senior_night', label: '🎓 Senior Night' },
  { value: 'first_varsity_hit', label: '⚾ First Varsity Hit' },
  { value: 'first_varsity_goal', label: '⚽ First Varsity Goal' },
  { value: 'no_hitter', label: '🔥 No-Hitter' },
  { value: 'hat_trick', label: '🎩 Hat Trick' },
  { value: 'walk_off_win', label: '🎉 Walk-Off Win' },
];

export default function ShoutoutPage() {
  const supabase = createClient();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    submitter_name: '',
    submitter_email: '',
    athlete_name: '',
    shoutout_type: 'player_of_game',
    description: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.submitter_name || !form.description) return;
    setSubmitting(true);
    await supabase.from('shoutouts').insert({
      ...form,
      approved: false,
    });
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold font-display text-white mb-2">Shoutout Submitted!</h1>
        <p className="text-slate-400">Thanks for the shoutout. It'll be reviewed before publishing.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Trophy size={24} className="text-yellow-400" />
        <h1 className="text-2xl font-bold font-display text-white">Give a Shoutout</h1>
      </div>
      <p className="text-slate-400 mb-6">Recognize an athlete, coach, or team for something great. All shoutouts are reviewed before publishing.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-slate-300 mb-1">Shoutout Type *</label>
          <select
            value={form.shoutout_type}
            onChange={e => setForm({ ...form, shoutout_type: e.target.value })}
            className="input w-full"
          >
            {SHOUTOUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">Athlete / Team Name</label>
          <input
            type="text"
            value={form.athlete_name}
            onChange={e => setForm({ ...form, athlete_name: e.target.value })}
            placeholder="e.g. John Smith or Canton Bears"
            className="input w-full"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1">Description *</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            required
            rows={4}
            placeholder="Tell us about it..."
            className="input w-full resize-none"
          />
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="text-xs text-slate-400 mb-3">Your info (will not be published)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-300 mb-1">Your Name *</label>
              <input
                type="text"
                value={form.submitter_name}
                onChange={e => setForm({ ...form, submitter_name: e.target.value })}
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={form.submitter_email}
                onChange={e => setForm({ ...form, submitter_email: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !form.submitter_name || !form.description}
          className="btn-primary w-full"
        >
          {submitting ? 'Submitting...' : 'Submit Shoutout'}
        </button>
      </form>
    </div>
  );
}
