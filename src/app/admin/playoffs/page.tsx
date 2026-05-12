'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'
import { Plus, Save, Trophy, ChevronDown, ChevronUp } from 'lucide-react'

export default function AdminPlayoffsPage() {
  const supabase = createClient()
  const [sports, setSports] = useState<any[]>([])
  const [seasons, setSeasons] = useState<any[]>([])
  const [tournaments, setTournaments] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  // New tournament form
  const [newT, setNewT] = useState({ sport_id: '', season_id: '', class: '', name: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: sp }, { data: se }, { data: tr }, { data: gm }, { data: tm }] = await Promise.all([
      supabase.from('sports').select('*').order('sport_name'),
      supabase.from('seasons').select('*').order('year', { ascending: false }),
      supabase.from('playoff_tournaments').select('*, sport:sports(sport_name,gender), season:seasons(name)').order('class'),
      supabase.from('playoff_games').select('*').order('round').order('position'),
      supabase.from('teams').select('id, team_name, sport_id, school:schools(school_name)').order('team_name'),
    ])
    setSports(sp || [])
    setSeasons(se || [])
    setTournaments(tr || [])
    setGames(gm || [])
    setTeams(tm || [])
    setLoading(false)

    // Default season to active
    const active = se?.find((s: any) => s.is_active)
    if (active) setNewT(p => ({ ...p, season_id: active.id }))
  }

  async function createTournament() {
    if (!newT.sport_id || !newT.season_id || !newT.class) return
    setCreating(true)
    const sportName = sports.find(s => s.id === newT.sport_id)?.sport_name || 'Sport'
    const name = newT.name || `Class ${newT.class} ${sportName} Playoffs`
    await supabase.from('playoff_tournaments').insert({ ...newT, name })
    setNewT(p => ({ ...p, class: '', name: '' }))
    load()
    setCreating(false)
  }

  async function addGame(tournamentId: string, round: number, position: number) {
    await supabase.from('playoff_games').insert({
      tournament_id: tournamentId, round, position,
      status: 'upcoming',
    })
    load()
  }

  async function updateGame(id: string, updates: any) {
    await supabase.from('playoff_games').update(updates).eq('id', id)
    load()
  }

  async function updateTournamentStatus(id: string, status: string) {
    await supabase.from('playoff_tournaments').update({ status }).eq('id', id)
    load()
  }

  const CLASS_OPTIONS = ['A', 'B', 'C', 'D']

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Trophy size={22} className="text-yellow-400" />
          <h1 className="text-2xl font-bold font-display text-white">Playoff Brackets</h1>
        </div>
        <p className="text-slate-400 text-sm mb-6">Create brackets, set seeds, and update scores as games are played.</p>

        {/* Create tournament */}
        <div className="card p-4 mb-6">
          <p className="text-sm font-bold text-white mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            + New Bracket
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">Sport</label>
              <select value={newT.sport_id} onChange={e => setNewT(p => ({ ...p, sport_id: e.target.value }))} className="input w-full">
                <option value="">Select...</option>
                {sports.map(s => <option key={s.id} value={s.id}>{s.gender} {s.sport_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Season</label>
              <select value={newT.season_id} onChange={e => setNewT(p => ({ ...p, season_id: e.target.value }))} className="input w-full">
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Class</label>
              <select value={newT.class} onChange={e => setNewT(p => ({ ...p, class: e.target.value }))} className="input w-full">
                <option value="">Select...</option>
                {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Name (optional)</label>
              <input value={newT.name} onChange={e => setNewT(p => ({ ...p, name: e.target.value }))}
                placeholder="Auto-generated" className="input w-full" />
            </div>
          </div>
          <button onClick={createTournament} disabled={creating || !newT.sport_id || !newT.class}
            className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Create Bracket
          </button>
        </div>

        {/* Tournaments */}
        {loading ? <div className="text-center py-8 text-slate-500">Loading...</div> : (
          <div className="space-y-4">
            {tournaments.map(t => {
              const tGames = games.filter(g => g.tournament_id === t.id)
              const isExpanded = expanded === t.id
              const tTeams = teams.filter(tm => tm.sport_id === t.sport_id)
              const rounds = [...new Set(tGames.map(g => g.round))].sort()
              const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0

              return (
                <div key={t.id} className="card overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : t.id)}>
                    <div>
                      <p className="text-xs text-slate-500">{t.sport?.gender} {t.sport?.sport_name} · {t.season?.name}</p>
                      <p className="text-white font-bold" style={{ fontFamily: 'var(--font-display)' }}>{t.name}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{tGames.length} games set</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={t.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => updateTournamentStatus(t.id, e.target.value)}
                        className="input text-xs py-1 px-2 w-28">
                        <option value="upcoming">Upcoming</option>
                        <option value="active">Active</option>
                        <option value="complete">Complete</option>
                      </select>
                      {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-white/8 p-4 space-y-4">
                      {/* Add round buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {['Quarterfinal (R1)', 'Semifinal (R2)', 'Final (R3)'].map((label, i) => {
                          const round = i + 1
                          const existing = tGames.filter(g => g.round === round)
                          const nextPos = existing.length + 1
                          return (
                            <button key={round} onClick={() => addGame(t.id, round, nextPos)}
                              className="btn-ghost text-xs flex items-center gap-1">
                              <Plus size={12} /> {label}
                            </button>
                          )
                        })}
                      </div>

                      {/* Games by round */}
                      {rounds.map(round => {
                        const roundGames = tGames.filter(g => g.round === round).sort((a, b) => a.position - b.position)
                        const roundLabels: Record<number, string> = { 1: 'Quarterfinals', 2: 'Semifinals', 3: 'Final' }
                        return (
                          <div key={round}>
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2"
                              style={{ fontFamily: 'var(--font-display)' }}>
                              {roundLabels[round] || `Round ${round}`}
                            </p>
                            <div className="space-y-3">
                              {roundGames.map(game => (
                                <GameEditor key={game.id} game={game} teams={tTeams}
                                  onSave={(updates) => updateGame(game.id, updates)} />
                              ))}
                            </div>
                          </div>
                        )
                      })}

                      {tGames.length === 0 && (
                        <p className="text-sm text-slate-600 text-center py-4">
                          Click a button above to add matchups to this bracket.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {tournaments.length === 0 && (
              <div className="card p-8 text-center text-slate-600">
                <Trophy size={32} className="mx-auto mb-3 opacity-30" />
                <p>No brackets yet. Create one above.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function GameEditor({ game, teams, onSave }: { game: any, teams: any[], onSave: (u: any) => void }) {
  const [form, setForm] = useState({
    seed_away: game.seed_away || '',
    seed_home: game.seed_home || '',
    away_name: game.away_name || '',
    home_name: game.home_name || '',
    away_score: game.away_score ?? '',
    home_score: game.home_score ?? '',
    status: game.status || 'upcoming',
    game_date: game.game_date || '',
    game_time: game.game_time?.slice(0,5) || '',
    location: game.location || '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await onSave({
      seed_away: form.seed_away ? parseInt(form.seed_away) : null,
      seed_home: form.seed_home ? parseInt(form.seed_home) : null,
      away_name: form.away_name || null,
      home_name: form.home_name || null,
      away_score: form.away_score !== '' ? parseInt(form.away_score) : null,
      home_score: form.home_score !== '' ? parseInt(form.home_score) : null,
      status: form.status,
      game_date: form.game_date || null,
      game_time: form.game_time ? form.game_time + ':00' : null,
      location: form.location || null,
    })
    setSaving(false)
  }

  return (
    <div className="rounded-xl p-4 border border-white/6" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <p className="text-xs text-slate-600 mb-3">Game {game.position}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        {/* Away */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-500">Away Team</p>
          <div className="flex gap-2">
            <input type="number" placeholder="#" value={form.seed_away}
              onChange={e => setForm(p => ({ ...p, seed_away: e.target.value }))}
              className="input w-14 text-center" />
            <input placeholder="Team name" value={form.away_name}
              onChange={e => setForm(p => ({ ...p, away_name: e.target.value }))}
              className="input flex-1" />
            <input type="number" placeholder="Score" value={form.away_score}
              onChange={e => setForm(p => ({ ...p, away_score: e.target.value }))}
              className="input w-16 text-center font-mono font-bold" />
          </div>
        </div>
        {/* Home */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-500">Home Team</p>
          <div className="flex gap-2">
            <input type="number" placeholder="#" value={form.seed_home}
              onChange={e => setForm(p => ({ ...p, seed_home: e.target.value }))}
              className="input w-14 text-center" />
            <input placeholder="Team name" value={form.home_name}
              onChange={e => setForm(p => ({ ...p, home_name: e.target.value }))}
              className="input flex-1" />
            <input type="number" placeholder="Score" value={form.home_score}
              onChange={e => setForm(p => ({ ...p, home_score: e.target.value }))}
              className="input w-16 text-center font-mono font-bold" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="input">
          <option value="upcoming">Upcoming</option>
          <option value="scheduled">Scheduled</option>
          <option value="final">Final</option>
        </select>
        <input type="date" value={form.game_date}
          onChange={e => setForm(p => ({ ...p, game_date: e.target.value }))}
          className="input" style={{ colorScheme: 'dark' }} />
        <input type="time" value={form.game_time}
          onChange={e => setForm(p => ({ ...p, game_time: e.target.value }))}
          className="input" style={{ colorScheme: 'dark' }} />
        <input placeholder="Location" value={form.location}
          onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
          className="input" />
      </div>
      <button onClick={save} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
        <Save size={13} /> {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
