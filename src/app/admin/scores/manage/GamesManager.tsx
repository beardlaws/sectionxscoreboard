'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminDb } from '@/lib/adminDb'
import { Trash2, Edit2, Save, X, Search, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'

interface Props {
  sports: { id: string; sport_name: string; gender: string }[]
  seasons: { id: string; name: string; is_active: boolean }[]
  teams: { id: string; team_name: string; sport_id: string; school: { school_name: string } | null }[]
}

export default function GamesManager({ sports, seasons, teams }: Props) {
  const supabase = createClient()
  const activeSeason = seasons.find(s => s.is_active) || seasons[0]

  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [seasonFilter, setSeasonFilter] = useState(activeSeason?.id || '')
  const [sportFilter, setSportFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editScores, setEditScores] = useState({ home: '', away: '', status: '', date: '', time: '' })
  const [editTeams, setEditTeams] = useState({ home_team_id: '', away_team_id: '', external_home_name: '', external_away_name: '' })
  const [editSportId, setEditSportId] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const fetchGames = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('games')
      .select(`id, game_date, game_time, home_score, away_score, status, source, parser_confidence, neutral_site, game_number,
        sport:sports(sport_name),
        home_team:teams!games_home_team_id_fkey(team_name, school:schools(school_name, primary_color)),
        away_team:teams!games_away_team_id_fkey(team_name, school:schools(school_name, primary_color))
      `)
      .order('game_date', { ascending: false })
      .order('game_time', { ascending: true })
      .limit(200)

    if (seasonFilter) q = (q as any).eq('season_id', seasonFilter)
    if (sportFilter) q = (q as any).eq('sport_id', sportFilter)
    if (statusFilter) q = (q as any).eq('status', statusFilter)

    const { data } = await q
    setGames((data || []))
    setLoading(false)
  }, [seasonFilter, sportFilter, statusFilter])

  useEffect(() => { fetchGames() }, [fetchGames])

  async function deleteGame(id: string) {
    if (!confirm('Delete this game?')) return
    setDeleting(id)
    await adminDb.delete('games', { id })
    setGames(prev => prev.filter(g => g.id !== id))
    setDeleting(null)
  }

  async function bulkDelete() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} games?`)) return
    setBulkDeleting(true)
    for (const id of selected) {
      await adminDb.delete('games', { id })
    }
    setGames(prev => prev.filter(g => !selected.has(g.id)))
    setSelected(new Set())
    setBulkDeleting(false)
  }

  async function saveEdit(id: string) {
    const updates: any = {
      home_score: editScores.home !== '' ? parseInt(editScores.home) : null,
      away_score: editScores.away !== '' ? parseInt(editScores.away) : null,
      status: editScores.status,
      game_date: editScores.date || null,
      game_time: editScores.time ? editScores.time + ':00' : null,
    }
    if (editTeams.home_team_id && editTeams.home_team_id !== 'EXTERNAL') updates.home_team_id = editTeams.home_team_id
    if (editTeams.away_team_id && editTeams.away_team_id !== 'EXTERNAL') updates.away_team_id = editTeams.away_team_id
    if (editTeams.home_team_id === 'EXTERNAL' && editTeams.external_home_name) updates.external_home_name = editTeams.external_home_name
    if (editTeams.away_team_id === 'EXTERNAL' && editTeams.external_away_name) updates.external_away_name = editTeams.external_away_name
    if (editScores.date) updates.game_date = editScores.date
    await adminDb.update('games', updates, { id })
    fetchGames()
    setEditingId(null)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function selectAll() {
    setSelected(new Set(filtered.map(g => g.id)))
  }

  function selectByStatus(status: string) {
    setSelected(new Set(filtered.filter(g => g.status === status).map(g => g.id)))
  }

  const filtered = games.filter(g => {
    if (!search) return true
    const ht = g.home_team?.school?.school_name || g.home_team?.team_name || ''
    const at = g.away_team?.school?.school_name || g.away_team?.team_name || ''
    return ht.toLowerCase().includes(search.toLowerCase()) ||
      at.toLowerCase().includes(search.toLowerCase())
  })

  const statusColors: Record<string, string> = {
    Final: 'bg-green-500/20 text-green-400',
    Scheduled: 'bg-blue-500/20 text-blue-400',
    Postponed: 'bg-yellow-500/20 text-yellow-400',
    Canceled: 'bg-red-500/20 text-red-400',
    Live: 'bg-red-500/20 text-red-300 animate-pulse',
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold font-display text-white mb-1">Manage Games</h1>
      <p className="text-slate-400 text-sm mb-5">Edit scores, delete games, or bulk-remove postponed/canceled entries.</p>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} className="input">
          <option value="">All Seasons</option>
          {seasons.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' ✓' : ''}</option>)}
        </select>
        <select value={sportFilter} onChange={e => setSportFilter(e.target.value)} className="input">
          <option value="">All Sports</option>
          {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name} ({s.gender})</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input">
          <option value="">All Statuses</option>
          <option>Final</option>
          <option>Scheduled</option>
          <option>Postponed</option>
          <option>Canceled</option>
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teams..." className="input w-full pl-8" />
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-slate-400">{filtered.length} games</span>
        <div className="flex-1" />
        {selected.size > 0 && (
          <>
            <span className="text-xs text-white">{selected.size} selected</span>
            <button onClick={() => setSelected(new Set())} className="text-xs px-2 py-1 bg-white/10 rounded text-slate-300">Clear</button>
            <button onClick={bulkDelete} disabled={bulkDeleting} className="text-xs px-3 py-1 bg-red-500/20 text-red-400 rounded font-medium hover:bg-red-500/30">
              {bulkDeleting ? 'Deleting...' : `Delete ${selected.size}`}
            </button>
          </>
        )}
        <button onClick={() => selectByStatus('Postponed')} className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">Select PPD</button>
        <button onClick={() => selectByStatus('Canceled')} className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded">Select Canceled</button>
        <button onClick={selectAll} className="text-xs px-2 py-1 bg-white/10 text-slate-300 rounded">Select All</button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading games...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">No games found.</div>
      ) : (
        <div className="space-y-1">
          {filtered.map(game => {
            const isEditing = editingId === game.id
            const isSelected = selected.has(game.id)
            const ht = game.home_team?.school?.school_name || game.home_team?.team_name || '?'
            const at = game.away_team?.school?.school_name || game.away_team?.team_name || '?'
            const htColor = game.home_team?.school?.primary_color || '#334155'
            const atColor = game.away_team?.school?.primary_color || '#334155'

            return (
              <div key={game.id} className={`card overflow-hidden transition-colors ${isSelected ? 'border-ice/40 bg-ice/5' : ''}`}>
              <div className="p-3 flex items-center gap-3">
                <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(game.id)} className="flex-shrink-0" />

                {/* Date */}
                <div className="w-20 flex-shrink-0 text-center">
                  <p className="text-xs text-slate-400">{game.game_date ? format(new Date(game.game_date + 'T12:00:00'), 'MMM d') : '—'}</p>
                  {game.game_time && <p className="text-xs text-slate-500">{game.game_time}</p>}
                </div>

                {/* Sport */}
                <div className="w-20 flex-shrink-0 hidden md:block">
                  <p className="text-xs text-slate-400 truncate">{game.sport?.sport_name}</p>
                </div>

                {/* Teams + Scores - display mode */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: atColor }} />
                    <span className="text-sm text-slate-200 truncate">{at}</span>
                    <span className="text-sm font-mono font-bold text-white ml-auto">{game.away_score ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: htColor }} />
                    <span className="text-sm text-slate-200 truncate">{ht}</span>
                    <span className="text-sm font-mono font-bold text-white ml-auto">{game.home_score ?? '—'}</span>
                  </div>
                </div>

                {/* Status badge */}
                <div className="flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[game.status] || 'bg-white/10 text-slate-400'}`}>
                    {game.status}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isEditing ? (
                    <>
                      <button onClick={() => saveEdit(game.id)} className="p-1.5 text-green-400 hover:text-green-300" title="Save"><Save size={14} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:text-white" title="Cancel"><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={async () => {
                          // If turning ON: clear all other GOTNs for this date first
                          if (!game.game_of_the_night) {
                            const sameDayGames = games.filter(g => g.game_date === game.game_date && g.game_of_the_night && g.id !== game.id)
                            for (const g of sameDayGames) {
                              await adminDb.update('games', { game_of_the_night: false }, { id: g.id })
                            }
                          }
                          await adminDb.update('games', { game_of_the_night: !game.game_of_the_night }, { id: game.id })
                          fetchGames()
                        }}
                        className={`p-1.5 transition-colors text-lg leading-none ${game.game_of_the_night ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                        title="Game of the Night"
                      >
                        ⭐
                      </button>
                      <button
                        onClick={() => {
                        setEditingId(game.id)
                        setEditScores({ home: game.home_score ?? '', away: game.away_score ?? '', status: game.status, date: game.game_date || '', time: game.game_time?.slice(0,5) || '' })
                        setEditTeams({ home_team_id: game.home_team_id || (game.external_home_opponent_id ? 'EXTERNAL' : ''), away_team_id: game.away_team_id || (game.external_away_opponent_id ? 'EXTERNAL' : ''), external_home_name: (game as any).external_home?.name || '', external_away_name: (game as any).external_away?.name || '' })
                        setEditSportId(game.sport_id || '')
                      }}
                        className="p-1.5 text-slate-400 hover:text-white"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteGame(game.id)} disabled={deleting === game.id} className="p-1.5 text-slate-400 hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Edit panel - expands below when pencil clicked */}
              {isEditing && (
                <div className="border-t border-white/8 p-4 space-y-3" style={{ background: 'rgba(10,15,28,0.8)' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1 font-semibold">Date</label>
                      <input type="date" value={editScores.date}
                        onChange={e => setEditScores(p => ({ ...p, date: e.target.value }))}
                        className="input w-full" style={{ colorScheme: 'dark' }} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1 font-semibold">Time</label>
                      <input type="time" value={editScores.time}
                        onChange={e => setEditScores(p => ({ ...p, time: e.target.value }))}
                        className="input w-full" style={{ colorScheme: 'dark' }} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1 font-semibold">Status</label>
                      <select value={editScores.status}
                        onChange={e => setEditScores(p => ({ ...p, status: e.target.value }))}
                        className="input w-full">
                        <option>Final</option>
                        <option>Scheduled</option>
                        <option>Postponed</option>
                        <option>Canceled</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1 font-semibold">Away Team</label>
                      <select className="input w-full mb-1" value={editTeams.away_team_id}
                        onChange={e => setEditTeams(p => ({ ...p, away_team_id: e.target.value }))}>
                        <option value="">— Select —</option>
                        <option value="EXTERNAL">⬇ Non-Section X (type below)</option>
                        {(editSportId ? teams.filter(t => t.sport_id === editSportId) : teams)
                          .sort((a,b) => (a.school?.school_name || a.team_name).localeCompare(b.school?.school_name || b.team_name))
                          .map(t => <option key={t.id} value={t.id}>{t.school?.school_name || t.team_name}</option>)}
                      </select>
                      {editTeams.away_team_id === 'EXTERNAL' && (
                        <input className="input w-full" placeholder="Team name e.g. Peru Central"
                          value={editTeams.external_away_name}
                          onChange={e => setEditTeams(p => ({ ...p, external_away_name: e.target.value }))} />
                      )}
                      <label className="block text-xs text-slate-400 mb-1 mt-2 font-semibold">Away Score</label>
                      <input type="number" min="0" value={editScores.away} placeholder="0"
                        onChange={e => setEditScores(p => ({ ...p, away: e.target.value }))}
                        className="input w-full text-center text-xl font-bold font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1 font-semibold">Home Team</label>
                      <select className="input w-full mb-1" value={editTeams.home_team_id}
                        onChange={e => setEditTeams(p => ({ ...p, home_team_id: e.target.value }))}>
                        <option value="">— Select —</option>
                        <option value="EXTERNAL">⬇ Non-Section X (type below)</option>
                        {(editSportId ? teams.filter(t => t.sport_id === editSportId) : teams)
                          .sort((a,b) => (a.school?.school_name || a.team_name).localeCompare(b.school?.school_name || b.team_name))
                          .map(t => <option key={t.id} value={t.id}>{t.school?.school_name || t.team_name}</option>)}
                      </select>
                      {editTeams.home_team_id === 'EXTERNAL' && (
                        <input className="input w-full" placeholder="Team name e.g. Peru Central"
                          value={editTeams.external_home_name}
                          onChange={e => setEditTeams(p => ({ ...p, external_home_name: e.target.value }))} />
                      )}
                      <label className="block text-xs text-slate-400 mb-1 mt-2 font-semibold">Home Score</label>
                      <input type="number" min="0" value={editScores.home} placeholder="0"
                        onChange={e => setEditScores(p => ({ ...p, home: e.target.value }))}
                        className="input w-full text-center text-xl font-bold font-mono" />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <button onClick={() => setEditingId(null)} className="btn-ghost">Cancel</button>
                    <button onClick={() => saveEdit(game.id)} className="btn-primary flex items-center gap-2">
                      <Save size={14} /> Save Changes
                    </button>
                  </div>
                </div>
              )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
