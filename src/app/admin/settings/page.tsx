'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Save, Loader } from 'lucide-react';

interface Setting {
  key: string;
  value: string;
  description?: string;
}

const SETTING_DEFINITIONS = [
  { key: 'site_title', label: 'Site Title', description: 'Appears in browser tab and SEO', default: 'Section X Scoreboard' },
  { key: 'site_tagline', label: 'Site Tagline', description: 'Short description for SEO', default: 'North Country High School Sports Scores & Schedules' },
  { key: 'og_image_url', label: 'Default OG Image URL', description: 'Fallback social share image' },
  { key: 'twitter_handle', label: 'Twitter/X Handle', description: 'e.g. @SectionXScores' },
  { key: 'facebook_url', label: 'Facebook URL' },
  { key: 'scores_email', label: 'Score Submission Email', description: 'Where emailed scores go' },
  { key: 'submission_notice', label: 'Public Submission Notice', description: 'Shown above submit score form', default: 'Know a score? Submit it here. All submissions are reviewed before publishing.' },
  { key: 'maintenance_mode', label: 'Maintenance Mode', description: '"true" to show maintenance page', default: 'false' },
  { key: 'alert_banner', label: 'Alert Banner', description: 'Optional sitewide banner message (blank to hide)' },
];

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    const { data } = await supabase.from('site_settings').select('*');
    const map: Record<string, string> = {};
    (data || []).forEach((s: Setting) => { map[s.key] = s.value; });
    setSettings(map);
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    const upserts = SETTING_DEFINITIONS.map(def => ({
      key: def.key,
      value: settings[def.key] ?? def.default ?? '',
    }));
    await supabase.from('site_settings').upsert(upserts, { onConflict: 'key' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-white">Site Settings</h1>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {SETTING_DEFINITIONS.map(def => (
            <div key={def.key} className="card p-4">
              <label className="block text-white font-medium mb-1">{def.label}</label>
              {def.description && <p className="text-xs text-slate-400 mb-2">{def.description}</p>}
              {def.key === 'alert_banner' || def.key === 'submission_notice' ? (
                <textarea
                  value={settings[def.key] ?? def.default ?? ''}
                  onChange={e => setSettings({ ...settings, [def.key]: e.target.value })}
                  rows={2}
                  className="input w-full resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={settings[def.key] ?? def.default ?? ''}
                  onChange={e => setSettings({ ...settings, [def.key]: e.target.value })}
                  className="input w-full"
                />
              )}
            </div>
          ))}

          {/* Active Season Display (read-only — managed in Seasons) */}
          <div className="card p-4 border-dashed border-white/20">
            <p className="text-slate-400 text-sm">
              💡 Active season is managed in <a href="/admin/seasons" className="text-ice hover:underline">Season Manager</a>.
              Toggle it there to change what appears on the homepage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
