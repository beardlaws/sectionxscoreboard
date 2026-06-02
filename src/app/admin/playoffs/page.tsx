'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminLayout from '@/components/layout/AdminLayout'

const supabase = createClient()

const CLASSES = ['A', 'B', 'C', 'D']
const ROUNDS = [
  { value: 0, label: 'Play-in' },
  { value: 1, label: 'Quarterfinals' },
  { value: 2, label: 'Semifinals' },
  { value: 3, label: 'Final' },
]

function roundLabel(v: number) {
  return ROUNDS.find(r => r.value === v)?.label || `Round ${v}`
}

// Creates or updates the linked regular game record for a playoff matchup
// This makes the game appear in scores feed, ticker, team pages - everywhere
async function syncPlayoffGameToRegular(
  playoffGame: any,
  tournament: any,
) {
  if (!playoffGame.id) return null

  const ROUND_NAMES: Record<number, string> = {
    0: 'Play-in', 1: 'Quarterfinals', 2: 'Semifinals', 3: 'Final'
  }

  // Find the team IDs for each school name if possible
  // (We store by name in playoff_games, but try to link to actual team records)
  let homeTeamId = null
  let awayTeamId = null

  if (playoffGame.home_name && tournament.sport_id) {
    const { data: ht } = await supabase
      .from('teams')
      .select('id, school:schools(school_name)')
      .eq('sport_id', tournament.sport_id)
      .ilike('team_name', `%${playoffGame.home_name.split(' ')[0]}%`)
      .limit(1)
      .single()
    if (ht) homeTeamId = ht.id
  }

  if (playoffGame.away_name && tournament.sport_id) {
    const { data: at } = await supabase
      .from('teams')
      .select('id')
      .eq('sport_id', tournament.sport_id)
      .ilike('team_name', `%${playoffGame.away_name.split(' ')[0]}%`)
      .limit(1)
      .single()
    if (at) awayTeamId = at.id
  }

  const gameData = {
    sport_id: tournament.sport_id,
    season_id: tournament.season_id,
    game_date: playoffGame.game_date || null,
    game_time: playoffGame.game_time || null,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    // Store names as notes if team IDs not found
    home_score: playoffGame.home_score ?? null,
    away_score: playoffGame.away_score ?? null,
    status: playoffGame.status === 'final' ? 'Final' :
            playoffGame.status === 'scheduled' ? 'Scheduled' : 'Scheduled',
    is_playoff: true,
    playoff_round: ROUND_NAMES[playoffGame.round] || null,
    playoff_game_id: playoffGame.id,
    location: playoffGame.location || null,
    notes: `${ROUND_NAMES[playoffGame.round] || ''} · Class ${tournament.class} · ${playoffGame.away_name || 'TBD'} vs ${playoffGame.home_name || 'TBD'}`,
    source: 'playoff_bracket',
    verification_status: 'Official',
  }

  // If already linked to a game, update it
  if (playoffGame.game_id) {
    await supabase.from('games').update(gameData).eq('id', playoffGame.game_id)
    return playoffGame.game_id
  }

  // Otherwise create new game record
  const { data: newGame } = await supabase.from('games').insert(gameData).select('id').single()
  if (newGame?.id) {
    // Link back to playoff_game
    await supabase.from('playoff_games').update({ game_id: newGame.id }).eq('id', playoffGame.id)
    return newGame.id
  }
  return null
}

export default function PlayoffsAdmin() {
  const [sports, setSports] = useState<any[]>([])
  const [seasons, setSeasons] = useState<any[]>([])
  const [tournaments, setTournaments] = useState<any[]>([])
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ sport_id: '', season_id: '', class: '', name: '' })
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: sp }, { data: se }, { data: tr }, { data: gm }] = await Promise.all([
      supabase.from('sports').select('id,sport_name,gender').order('sport_name'),
      supabase.from('seasons').select('id,name,is_active').order('year', { ascending: false }),
      supabase.from('playoff_tournaments').select('*').order('created_at'),
      supabase.from('playoff_games').select('*').order('round').order('position'),
    ])
    setSports(sp || [])
    setSeasons(se || [])
    setTournaments(tr || [])
    setGames(gm || [])
    const active = (se || []).find((s: any) => s.is_active)
    if (active) setForm(p => ({ ...p, season_id: p.season_id || active.id }))
    setLoading(false)
  }

  async function createBracket() {
    if (!form.sport_id || !form.season_id || !form.class) { setMsg('Select sport, season, and class.'); return }
    setCreating(true); setMsg('')
    const sport = sports.find(s => s.id === form.sport_id)
    const sportDisplay = (sport?.sport_name || '').includes(sport?.gender || '@@') ? sport?.sport_name : `${sport?.gender} ${sport?.sport_name}`
    const name = form.name || `Class ${form.class} ${sportDisplay} Playoffs`
    const { data, error } = await supabase.from('playoff_tournaments')
      .insert({ sport_id: form.sport_id, season_id: form.season_id, class: form.class, name, status: 'upcoming' })
      .select().single()
    if (error) setMsg('Error: ' + error.message)
    else { setMsg('Bracket created!'); setOpenId(data.id); load() }
    setCreating(false)
  }

  async function addGame(tournament: any, round: number) {
    const pos = games.filter(g => g.tournament_id === tournament.id && g.round === round).length + 1
    const { data: pg } = await supabase.from('playoff_games')
      .insert({ tournament_id: tournament.id, round, position: pos, status: 'upcoming' })
      .select().single()
    if (pg) {
      // Immediately create a linked game record so it appears in scores feed
      await syncPlayoffGameToRegular(pg, tournament)
    }
    load()
  }

  async function saveGame(game: any, tournament: any) {
    const { id, ...updates } = game
    const { error } = await supabase.from('playoff_games').update(updates).eq('id', id)
    if (error) { alert('Save error: ' + error.message); return }
    // Sync to regular games table
    const updatedGame = { ...game, id }
    await syncPlayoffGameToRegular(updatedGame, tournament)
    load()
  }

  async function deleteTournament(id: string) {
    if (!confirm('Delete this bracket and all its games?')) return
    // Also clean up linked regular games
    const tGames = games.filter(g => g.tournament_id === id && g.game_id)
    for (const g of tGames) {
      await supabase.from('games').update({ is_playoff: false, playoff_game_id: null }).eq('id', g.game_id)
    }
    await supabase.from('playoff_games').delete().eq('tournament_id', id)
    await supabase.from('playoff_tournaments').delete().eq('id', id)
    load()
  }

  async function deleteGame(pg: any) {
    // Unlink from regular game but don't delete the regular game
    if (pg.game_id) {
      await supabase.from('games').update({ is_playoff: false, playoff_game_id: null, playoff_round: null }).eq('id', pg.game_id)
    }
    await supabase.from('playoff_games').delete().eq('id', pg.id)
    load()
  }

  return (
    <AdminLayout>
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-black text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>🏆 Playoff Brackets</h1>
        <p className="text-slate-400 text-sm mb-1">Create a bracket per class per sport. Matchups automatically appear in the scores feed.</p>
        <p className="text-xs text-blue-400 mb-5">Works for all sports and all future seasons — just create a new bracket each year.</p>

        {/* Create form */}
        <div className="card p-4 mb-6">
          <p className="text-sm font-bold text-white mb-3">Create New Bracket</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="label">Sport *</label>
              <select className="input w-full" value={form.sport_id} onChange={e => setForm(p => ({ ...p, sport_id: e.target.value }))}>
                <option value="">Select...</option>
                {sports.map(s => {
                  const name = s.sport_name.includes(s.gender) ? s.sport_name : `${s.gender} ${s.sport_name}`
                  return <option key={s.id} value={s.id}>{name}</option>
                })}
              </select>
            </div>
            <div>
              <label className="label">Season *</label>
              <select className="input w-full" value={form.season_id} onChange={e => setForm(p => ({ ...p, season_id: e.target.value }))}>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' ✓' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Class *</label>
              <select className="input w-full" value={form.class} onChange={e => setForm(p => ({ ...p, class: e.target.value }))}>
                <option value="">Select...</option>
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Name (optional)</label>
              <input className="input w-full" placeholder="Auto-generated" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
          </div>
          {msg && <p className={`text-sm mb-2 ${msg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{msg}</p>}
          <button onClick={createBracket} disabled={creating} className="btn-primary">
            {creating ? 'Creating...' : '+ Create Bracket'}
          </button>
        </div>

        {/* Brackets */}
        {loading ? <div className="text-center py-8 text-slate-500">Loading...</div> : (
          <div className="space-y-4">
            {tournaments.length === 0 && <div className="card p-8 text-center text-slate-500">No brackets yet.</div>}
            {tournaments.map(t => {
              const tGames = games.filter(g => g.tournament_id === t.id)
              const rounds = [...new Set(tGames.map(g => g.round))].sort((a, b) => a - b)
              const sport = sports.find(s => s.id === t.sport_id)
              const sportDisplay = sport ? ((sport.sport_name.includes(sport.gender) ? sport.sport_name : `${sport.gender} ${sport.sport_name}`)) : ''
              const isOpen = openId === t.id

              return (
                <div key={t.id} className="card overflow-hidden">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02]"
                    onClick={() => setOpenId(isOpen ? null : t.id)}>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">
                        {sportDisplay} · Class {t.class} · {seasons.find(s => s.id === t.season_id)?.name}
                      </p>
                      <p className="text-white font-bold" style={{ fontFamily: 'var(--font-display)' }}>{t.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-600">{tGames.length} matchups</span>
                        <span className="text-xs text-emerald-400">{tGames.filter(g => g.game_id).length} linked to scores feed</span>
                        <a href={`/playoffs/${t.id}`} target="_blank" rel="noopener"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-blue-400 hover:text-blue-300">View Public →</a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select value={t.status} onClick={e => e.stopPropagation()}
                        onChange={async e => {
                          e.stopPropagation()
                          await supabase.from('playoff_tournaments').update({ status: e.target.value }).eq('id', t.id)
                          load()
                        }}
                        className="input text-xs py-1 px-2">
                        <option value="upcoming">Upcoming</option>
                        <option value="active">Active</option>
                        <option value="complete">Complete</option>
                      </select>
                      <button onClick={e => { e.stopPropagation(); deleteTournament(t.id) }}
                        className="text-red-400 hover:text-red-300 text-xs px-2">✕</button>
                      <span className="text-slate-500">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-white/8 p-4">
                      <div className="flex gap-2 flex-wrap mb-4">
                        <p className="text-xs text-slate-500 w-full mb-1">
                          Add matchup → automatically appears in scores feed for {seasons.find(s => s.id === t.season_id)?.name}:
                        </p>
                        {ROUNDS.map(r => (
                          <button key={r.value} onClick={() => addGame(t, r.value)}
                            className="btn-ghost text-xs py-1 px-3">+ {r.label}</button>
                        ))}
                      </div>

                      {rounds.map(round => {
                        const roundGames = tGames.filter(g => g.round === round).sort((a, b) => a.position - b.position)
                        return (
                          <div key={round} className="mb-5">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2"
                              style={{ fontFamily: 'var(--font-display)' }}>{roundLabel(round)}</p>
                            <div className="space-y-3">
                              {roundGames.map(game => (
                                <GameRow key={game.id} game={game}
                                  onSave={(g) => saveGame(g, t)}
                                  onDelete={() => deleteGame(game)} />
                              ))}
                            </div>
                          </div>
                        )
                      })}

                      {tGames.length === 0 && (
                        <p className="text-sm text-slate-600 text-center py-4">Click a round button above to add matchups. They'll appear in the scores feed automatically.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function GameRow({ game, onSave, onDelete }: { game: any, onSave: (g: any) => void, onDelete: () => void }) {
  const [f, setF] = useState({
    away_name: game.away_name || '', home_name: game.home_name || '',
    seed_away: game.seed_away ?? '', seed_home: game.seed_home ?? '',
    away_score: game.away_score ?? '', home_score: game.home_score ?? '',
    status: game.status || 'upcoming',
    game_date: game.game_date || '', game_time: game.game_time?.slice(0, 5) || '',
    location: game.location || '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await onSave({
      id: game.id, game_id: game.game_id,
      away_name: f.away_name || null, home_name: f.home_name || null,
      seed_away: f.seed_away !== '' ? parseInt(String(f.seed_away)) : null,
      seed_home: f.seed_home !== '' ? parseInt(String(f.seed_home)) : null,
      away_score: f.away_score !== '' ? parseInt(String(f.away_score)) : null,
      home_score: f.home_score !== '' ? parseInt(String(f.home_score)) : null,
      status: f.status, round: game.round, position: game.position,
      game_date: f.game_date || null,
      game_time: f.game_time ? f.game_time + ':00' : null,
      location: f.location || null,
    })
    setSaving(false)
  }

  const isLinked = !!game.game_id

  return (
    <div className="rounded-xl border border-white/8 p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
      {isLinked && (
        <p className="text-xs text-emerald-400 mb-2 flex items-center gap-1">
          <span>✓</span> Linked to scores feed
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-slate-500 mb-1">Away Team</p>
          <div className="flex gap-2">
            <input type="number" placeholder="Seed #" value={f.seed_away}
              onChange={e => setF(p => ({ ...p, seed_away: e.target.value }))}
              className="input w-16 text-center" />
            <input placeholder="Team name" value={f.away_name}
              onChange={e => setF(p => ({ ...p, away_name: e.target.value }))}
              className="input flex-1" />
            <input type="number" placeholder="Score" value={f.away_score}
              onChange={e => setF(p => ({ ...p, away_score: e.target.value }))}
              className="input w-16 text-center font-mono font-bold" />
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">Home Team</p>
          <div className="flex gap-2">
            <input type="number" placeholder="Seed #" value={f.seed_home}
              onChange={e => setF(p => ({ ...p, seed_home: e.target.value }))}
              className="input w-16 text-center" />
            <input placeholder="Team name" value={f.home_name}
              onChange={e => setF(p => ({ ...p, home_name: e.target.value }))}
              className="input flex-1" />
            <input type="number" placeholder="Score" value={f.home_score}
              onChange={e => setF(p => ({ ...p, home_score: e.target.value }))}
              className="input w-16 text-center font-mono font-bold" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))}
          className="input text-sm py-1.5" style={{ width: 'auto' }}>
          <option value="upcoming">Upcoming</option>
          <option value="scheduled">Scheduled</option>
          <option value="final">Final</option>
        </select>
        <input type="date" value={f.game_date}
          onChange={e => setF(p => ({ ...p, game_date: e.target.value }))}
          className="input text-sm py-1.5" style={{ colorScheme: 'dark', width: 'auto' }} />
        <input type="time" value={f.game_time}
          onChange={e => setF(p => ({ ...p, game_time: e.target.value }))}
          className="input text-sm py-1.5" style={{ colorScheme: 'dark', width: 'auto' }} />
        <input placeholder="Location" value={f.location}
          onChange={e => setF(p => ({ ...p, location: e.target.value }))}
          className="input text-sm py-1.5 flex-1" />
        <button onClick={save} disabled={saving} className="btn-primary text-sm py-1.5">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onDelete} className="btn-danger text-sm py-1.5">Del</button>
      </div>
    </div>
  )
}
