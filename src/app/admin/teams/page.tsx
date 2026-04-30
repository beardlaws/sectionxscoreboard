'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { adminDb } from '@/lib/adminDb'
import { Season } from '@/types'
import { Search, ToggleLeft, ToggleRight, Edit2, Save, X, Plus, AlertCircle } from 'lucide-react'

const CLASSES = ['A', 'B', 'C', 'D']
const DIVISIONS = ['East', 'Central', 'West', 'North', 'South']

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function AdminTeamsPage() {
  const supabase = createClient()
  const [teams, setTeams] = useState<any[]>([])
  const [schools, setSchools] = useState<any[]>([])
  const [sports, setSports] = useState<any[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSeason, setSelectedSeason] = useState('')
  const [search, setSearch] = useState('')
  const [sportFilter, setSportFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({ class: '', division: '' })
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [addForm, setAddForm] = useState({
    school_id: '', sport_id: '', level: 'Varsity', class: '', division: '',
  })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    async function init() {
      const [{ data: s }, { data: activeSeason }, { data: schoolData }, { data: sportData }] = await Promise.all([
        supabase.from('seasons').select('*').order('year', { ascending: false }),
        supabase.from('seasons').select('*').eq('is_active', true).single(),
        supabase.from('schools').select('id, school_name, alias').order('school_name'),
        supabase.from('sports').select('id, sport_name, gender, season_type').order('sport_name'),
      ])
      setSeasons((s as Season[]) || [])
      setSchools(schoolData || [])
      setSports(sportData || [])
      if (activeSeason) setSelectedSeason(activeSeason.id)
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => { if (selectedSeason) fetchTeams() }, [selectedSeason])

  async function fetchTeams() {
    const { data } = await supabase
      .from('teams')
      .select(`
        *,
        school:schools(school_name, primary_color, city),
        sport:sports(sport_name, gender, season_type),
        team_seasons!left(id, active_for_season, class, division, season_id)
      `)
      .order('school_id').order('sport_id')

    const processed = (data || []).map((t: any) => ({
      ...t,
      current_season: t.team_seasons?.find((ts: any) => ts.season_id === selectedSeason) || null,
    }))
    setTeams(processed)
  }

  async function addTeam() {
    if (!addForm.school_id || !addForm.sport_id) {
      setAddError('School and sport are required.')
      return
    }
    setAdding(true)
    setAddError('')

    const school = schools.find(s => s.id === addForm.school_id)
    const sport = sports.find(s => s.id === addForm.sport_id)
    if (!school || !sport) { setAddError('Invalid school or sport.'); setAdding(false); return }

    const teamName = `${school.school_name} ${sport.sport_name}`
    const slug = slugify(`${school.school_name} ${sport.sport_name}`)

    // Check if team already exists
    const { data: existing } = await supabase.from('teams')
      .select('id').eq('school_id', addForm.school_id).eq('sport_id', addForm.sport_id).limit(1)
    
    let teamId: string

    if (existing && existing.length > 0) {
      teamId = existing[0].id
    } else {
      const { data: newTeam, error } = await supabase.from('teams')
        .insert({ school_id: addForm.school_id, sport_id: addForm.sport_id, team_name: teamName, slug, level: addForm.level, active: true })
        .select('id').single()
      if (error || !newTeam) { setAddError(error?.message || 'Failed to create team'); setAdding(false); return }
      teamId = newTeam.id
    }

    // Add to current season
    if (selectedSeason) {
      const { data: existingTs } = await supabase.from('team_seasons')
        .select('id').eq('team_id', teamId).eq('season_id', selectedSeason).limit(1)
      
      if (!existingTs || existingTs.length === 0) {
        await adminDb.insert('team_seasons', {
          team_id: teamId, season_id: selectedSeason,
          active_for_season: true,
          class: addForm.class || null,
          division: addForm.division || null,
        })
      } else {
        await adminDb.update('team_seasons', { active_for_season: true }, { id: existingTs[0].id })
      }
    }

    setShowAddTeam(false)
    setAddForm({ school_id: '', sport_id: '', level: 'Varsity', class: '', division: '' })
    fetchTeams()
    setAdding(false)
  }

  async function toggleTeamSeason(team: any) {
    const existing = team.current_season
    if (existing) {
      await adminDb.update('team_seasons', { active_for_season: !existing.active_for_season }, { id: existing.id })
    } else {
      await adminDb.insert('team_seasons', {
        team_id: team.id, season_id: selectedSeason, active_for_season: true, class: '', division: '',
      })
    }
    fetchTeams()
  }

  function startEdit(team: any) {
    setEditingId(team.id)
    setEditValues({ class: team.current_season?.class || '', division: team.current_season?.division || '' })
  }

  async function saveEdit(team: any) {
    const existing = team.current_season
    if (existing) {
      await adminDb.update('team_seasons', { class: editValues.class, division: editValues.division }, { id: existing.id })
    } else {
      await adminDb.insert('team_seasons', {
        team_id: team.id, season_id: selectedSeason, active_for_season: true,
        class: editValues.class, division: editValues.division,
      })
    }
    setEditingId(null)
    fetchTeams()
  }

  const sportNames = [...new Set(teams.map(t => t.sport?.sport_name).filter(Boolean))].sort()
  const filtered = teams.filter(t => {
    const matchSearch = !search ||
      t.school?.school_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.sport?.sport_name?.toLowerCase().includes(search.toLowerCase())
    const matchSport = !sportFilter || t.sport?.sport_name === sportFilter
    return matchSearch && matchSport
  })

  const genderIcon = (g: string) => g === 'Boys' ? '♂' : g === 'Girls' ? '♀' : ''

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold font-display text-white">Team Manager</h1>
        <button onClick={() => setShowAddTeam(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Team
        </button>
      </div>
      <p className="text-slate-400 text-sm mb-5">
        Toggle teams active/inactive. Click <Edit2 size={12} className="inline" /> to set class/division. Use <strong>Add Team</strong> to create new teams.
      </p>

      {/* Add Team Modal */}
      {showAddTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white font-display">Add New Team</h2>
              <button onClick={() => { setShowAddTeam(false); setAddError('') }}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">School *</label>
                <select value={addForm.school_id} onChange={e => setAddForm(p => ({ ...p, school_id: e.target.value }))} className="input w-full">
                  <option value="">Select school...</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.school_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Sport *</label>
                <select value={addForm.sport_id} onChange={e => setAddForm(p => ({ ...p, sport_id: e.target.value }))} className="input w-full">
                  <option value="">Select sport...</option>
                  {sports.map(s => <option key={s.id} value={s.id}>{s.gender} {s.sport_name} ({s.season_type})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Class</label>
                  <select value={addForm.class} onChange={e => setAddForm(p => ({ ...p, class: e.target.value }))} className="input w-full">
                    <option value="">—</option>
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Division</label>
                  <select value={addForm.division} onChange={e => setAddForm(p => ({ ...p, division: e.target.value }))} className="input w-full">
                    <option value="">—</option>
                    {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              {addError && (
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={14} /> {addError}
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => { setShowAddTeam(false); setAddError('') }} className="btn-secondary">Cancel</button>
                <button onClick={addTeam} disabled={adding} className="btn-primary">
                  {adding ? 'Adding...' : 'Add Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Season</label>
          <select value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)} className="input w-full">
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name} {s.is_active ? '✓' : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Sport</label>
          <select value={sportFilter} onChange={e => setSportFilter(e.target.value)} className="input w-full">
            <option value="">All Sports</option>
            {sportNames.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="School or sport..." className="input w-full pl-8" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-3">{filtered.length} teams</p>
          <div className="space-y-2">
            {filtered.map(team => {
              const isActive = team.current_season?.active_for_season ?? false
              const hasEntry = !!team.current_season
              const isEditing = editingId === team.id
              const cls = team.current_season?.class
              const div = team.current_season?.division

              return (
                <div key={team.id} className={`card p-3 transition-all ${!isActive && hasEntry ? 'opacity-50' : ''}`}>
                  {isEditing ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="w-7 h-7 rounded-full flex-shrink-0 text-white text-xs flex items-center justify-center font-bold"
                        style={{ backgroundColor: team.school?.primary_color || '#334155' }}>
                        {team.school?.school_name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{team.school?.school_name}</p>
                        <p className="text-xs text-slate-400">{genderIcon(team.sport?.gender)} {team.sport?.sport_name}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Class</label>
                          <select value={editValues.class} onChange={e => setEditValues(p => ({ ...p, class: e.target.value }))} className="input py-1 text-sm w-20">
                            <option value="">—</option>
                            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Division</label>
                          <select value={editValues.division} onChange={e => setEditValues(p => ({ ...p, division: e.target.value }))} className="input py-1 text-sm w-28">
                            <option value="">—</option>
                            {DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-1 mt-4">
                          <button onClick={() => saveEdit(team)} className="p-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"><Save size={14} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded bg-white/10 text-slate-400 hover:bg-white/20"><X size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full flex-shrink-0 text-white text-xs flex items-center justify-center font-bold"
                          style={{ backgroundColor: team.school?.primary_color || '#334155' }}>
                          {team.school?.school_name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{team.school?.school_name}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-slate-400">{genderIcon(team.sport?.gender)} {team.sport?.sport_name}</p>
                            {cls && <span className="text-xs px-1.5 py-0.5 rounded bg-ice/10 text-ice border border-ice/20">Class {cls}</span>}
                            {div && <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10">{div}</span>}
                            {!cls && !div && hasEntry && <span className="text-xs text-slate-600 italic">no class/div set</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => startEdit(team)} className="p-1.5 text-slate-500 hover:text-white transition-colors rounded hover:bg-white/10" title="Edit class & division">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => toggleTeamSeason(team)}
                          className={`flex items-center gap-1 text-sm transition-colors ${isActive ? 'text-green-400' : 'text-slate-500 hover:text-slate-300'}`}>
                          {isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          <span className="text-xs hidden sm:inline w-16">{isActive ? 'Active' : hasEntry ? 'Inactive' : 'Not Added'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
