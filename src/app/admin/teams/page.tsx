'use client'

import { useState, useEffect } from 'react'
import { adminDb } from '@/lib/adminDb'
import { Season } from '@/types'
import { Search, ToggleLeft, ToggleRight, Edit2, Save, X, Plus, AlertCircle } from 'lucide-react'

const CLASSES = ['A', 'B', 'C', 'D']
const DIVISIONS = ['East', 'Central', 'West', 'North', 'South']

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function AdminTeamsPage() {
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
  const [addForm, setAddForm] = useState({ school_id: '', sport_id: '', level: 'Varsity', class: '', division: '' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    async function init() {
      try {
        const [seasonResult, schoolResult, sportResult] = await Promise.all([
          adminDb.select('seasons', { orderBy: 'year', direction: 'desc', limit: 100 }),
          adminDb.select('schools', { columns: ['id','school_name','alias','primary_color','city'], orderBy: 'school_name', direction: 'asc', limit: 500 }),
          adminDb.select('sports', { columns: ['id','sport_name','gender','season_type'], orderBy: 'sport_name', direction: 'asc', limit: 500 }),
        ])
        const seasonRows = (seasonResult.data || []).map((s:any)=>({...s,is_active:Boolean(s.is_active)}))
        setSeasons(seasonRows as Season[])
        setSchools(schoolResult.data || [])
        setSports(sportResult.data || [])
        const active = seasonRows.find((s:any)=>s.is_active)
        if (active) setSelectedSeason(active.id)
        else if (seasonRows[0]) setSelectedSeason(seasonRows[0].id)
      } catch (e:any) { setAddError(e?.message || 'Could not load team manager data.') }
      finally { setLoading(false) }
    }
    void init()
  }, [])

  useEffect(() => { if (selectedSeason) void fetchTeams() }, [selectedSeason])

  async function fetchTeams() {
    try {
      const [teamResult, schoolResult, sportResult, tsResult] = await Promise.all([
        adminDb.select('teams', { orderBy: 'school_id', direction: 'asc', limit: 1000 }),
        adminDb.select('schools', { columns: ['id','school_name','primary_color','city'], limit: 500 }),
        adminDb.select('sports', { columns: ['id','sport_name','gender','season_type'], limit: 500 }),
        adminDb.select('team_seasons', { match: { season_id: selectedSeason }, limit: 1000 }),
      ])
      const schoolMap = new Map((schoolResult.data || []).map((s:any)=>[s.id,s]))
      const sportMap = new Map((sportResult.data || []).map((s:any)=>[s.id,s]))
      const seasonMap = new Map((tsResult.data || []).map((ts:any)=>[ts.team_id,{...ts,active_for_season:Boolean(ts.active_for_season)}]))
      const processed = (teamResult.data || []).map((t:any)=>({ ...t, school: schoolMap.get(t.school_id)||null, sport: sportMap.get(t.sport_id)||null, current_season: seasonMap.get(t.id)||null }))
      processed.sort((a:any,b:any)=>`${a.school?.school_name||''} ${a.sport?.sport_name||''}`.localeCompare(`${b.school?.school_name||''} ${b.sport?.sport_name||''}`))
      setTeams(processed)
    } catch(e:any) { setAddError(e?.message || 'Could not load teams.') }
  }

  async function addTeam() {
    if (!addForm.school_id || !addForm.sport_id) { setAddError('School and sport are required.'); return }
    setAdding(true); setAddError('')
    try {
      const school = schools.find(s => s.id === addForm.school_id)
      const sport = sports.find(s => s.id === addForm.sport_id)
      if (!school || !sport) throw new Error('Invalid school or sport.')
      const teamName = `${school.school_name} ${sport.sport_name}`
      const slug = slugify(`${school.school_name} ${sport.sport_name}`)
      const existing = await adminDb.select('teams', { match: { school_id: addForm.school_id, sport_id: addForm.sport_id }, columns: ['id'], limit: 1 })
      let teamId = existing.data?.[0]?.id
      if (!teamId) {
        const created = await adminDb.insert('teams', { school_id:addForm.school_id, sport_id:addForm.sport_id, team_name:teamName, slug, level:addForm.level, active:true })
        teamId = created.data?.id
      }
      if (!teamId) throw new Error('Failed to create team.')
      if (selectedSeason) {
        const existingTs = await adminDb.select('team_seasons', { match: { team_id: teamId, season_id: selectedSeason }, columns: ['id'], limit: 1 })
        if (!existingTs.data?.length) await adminDb.insert('team_seasons', { team_id:teamId, season_id:selectedSeason, active_for_season:true, class:addForm.class||null, division:addForm.division||null })
        else await adminDb.update('team_seasons', { active_for_season:true }, { id:existingTs.data[0].id })
      }
      setShowAddTeam(false)
      setAddForm({ school_id:'', sport_id:'', level:'Varsity', class:'', division:'' })
      await fetchTeams()
    } catch(e:any) { setAddError(e?.message || 'Failed to add team.') }
    finally { setAdding(false) }
  }

  async function toggleTeamSeason(team: any) {
    const existing = team.current_season
    if (existing) await adminDb.update('team_seasons', { active_for_season: !existing.active_for_season }, { id: existing.id })
    else await adminDb.insert('team_seasons', { team_id:team.id, season_id:selectedSeason, active_for_season:true, class:'', division:'' })
    await fetchTeams()
  }

  function startEdit(team: any) { setEditingId(team.id); setEditValues({ class: team.current_season?.class || '', division: team.current_season?.division || '' }) }

  async function saveEdit(team: any) {
    const existing = team.current_season
    if (existing) await adminDb.update('team_seasons', { class:editValues.class, division:editValues.division }, { id:existing.id })
    else await adminDb.insert('team_seasons', { team_id:team.id, season_id:selectedSeason, active_for_season:true, class:editValues.class, division:editValues.division })
    setEditingId(null)
    await fetchTeams()
  }

  const sportNames = [...new Set(teams.map(t => t.sport?.sport_name).filter(Boolean))].sort() as string[]
  const filtered = teams.filter(t => {
    const matchSearch = !search || t.school?.school_name?.toLowerCase().includes(search.toLowerCase()) || t.sport?.sport_name?.toLowerCase().includes(search.toLowerCase())
    const matchSport = !sportFilter || t.sport?.sport_name === sportFilter
    return matchSearch && matchSport
  })
  const genderIcon = (g: string) => g === 'Boys' ? '♂' : g === 'Girls' ? '♀' : ''

  return <div className="p-4 md:p-6 max-w-5xl mx-auto">
    <div className="flex items-center justify-between mb-2"><h1 className="text-2xl font-bold font-display text-white">Team Manager</h1><button onClick={()=>setShowAddTeam(true)} className="btn-primary flex items-center gap-2"><Plus size={16}/> Add Team</button></div>
    <p className="text-slate-400 text-sm mb-5">Toggle teams active/inactive. Click <Edit2 size={12} className="inline"/> to set class/division. Use <strong>Add Team</strong> to create new teams.</p>
    {addError&&<div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"><AlertCircle size={14}/>{addError}</div>}
    {showAddTeam&&<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)'}}><div className="card p-6 w-full max-w-md"><div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold text-white font-display">Add New Team</h2><button onClick={()=>{setShowAddTeam(false);setAddError('')}}><X size={18} className="text-slate-400"/></button></div><div className="space-y-3"><div><label className="label">School *</label><select value={addForm.school_id} onChange={e=>setAddForm(p=>({...p,school_id:e.target.value}))} className="input w-full"><option value="">Select school...</option>{schools.map(s=><option key={s.id} value={s.id}>{s.school_name}</option>)}</select></div><div><label className="label">Sport *</label><select value={addForm.sport_id} onChange={e=>setAddForm(p=>({...p,sport_id:e.target.value}))} className="input w-full"><option value="">Select sport...</option>{sports.map(s=><option key={s.id} value={s.id}>{s.gender} {s.sport_name} ({s.season_type})</option>)}</select></div><div className="grid grid-cols-2 gap-3"><div><label className="label">Class</label><select value={addForm.class} onChange={e=>setAddForm(p=>({...p,class:e.target.value}))} className="input w-full"><option value="">—</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className="label">Division</label><select value={addForm.division} onChange={e=>setAddForm(p=>({...p,division:e.target.value}))} className="input w-full"><option value="">—</option>{DIVISIONS.map(d=><option key={d} value={d}>{d}</option>)}</select></div></div><div className="flex gap-2 justify-end pt-2"><button onClick={()=>{setShowAddTeam(false);setAddError('')}} className="btn-secondary">Cancel</button><button onClick={addTeam} disabled={adding} className="btn-primary">{adding?'Adding...':'Add Team'}</button></div></div></div></div>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5"><div><label className="block text-xs text-slate-400 mb-1">Season</label><select value={selectedSeason} onChange={e=>setSelectedSeason(e.target.value)} className="input w-full">{seasons.map(s=><option key={s.id} value={s.id}>{s.name} {s.is_active?'✓':''}</option>)}</select></div><div><label className="block text-xs text-slate-400 mb-1">Sport</label><select value={sportFilter} onChange={e=>setSportFilter(e.target.value)} className="input w-full"><option value="">All Sports</option>{sportNames.map(s=><option key={s} value={s}>{s}</option>)}</select></div><div><label className="block text-xs text-slate-400 mb-1">Search</label><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="School or sport..." className="input w-full pl-8"/></div></div></div>
    {loading?<div className="text-center py-8 text-slate-400">Loading...</div>:<><p className="text-xs text-slate-500 mb-3">{filtered.length} teams</p><div className="space-y-2">{filtered.map(team=>{const isActive=team.current_season?.active_for_season??false,hasEntry=!!team.current_season,isEditing=editingId===team.id,cls=team.current_season?.class,div=team.current_season?.division;return <div key={team.id} className={`card p-3 transition-all ${!isActive&&hasEntry?'opacity-50':''}`}>{isEditing?<div className="flex items-center gap-3 flex-wrap"><div className="w-7 h-7 rounded-full flex-shrink-0 text-white text-xs flex items-center justify-center font-bold" style={{backgroundColor:team.school?.primary_color||'#334155'}}>{team.school?.school_name?.[0]}</div><div className="flex-1 min-w-0"><p className="text-white text-sm font-medium">{team.school?.school_name}</p><p className="text-xs text-slate-400">{genderIcon(team.sport?.gender)} {team.sport?.sport_name}</p></div><div className="flex items-center gap-2 flex-wrap"><div><label className="block text-xs text-slate-500 mb-0.5">Class</label><select value={editValues.class} onChange={e=>setEditValues(p=>({...p,class:e.target.value}))} className="input py-1 text-sm w-20"><option value="">—</option>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-xs text-slate-500 mb-0.5">Division</label><select value={editValues.division} onChange={e=>setEditValues(p=>({...p,division:e.target.value}))} className="input py-1 text-sm w-28"><option value="">—</option>{DIVISIONS.map(d=><option key={d} value={d}>{d}</option>)}</select></div><div className="flex items-center gap-1 mt-4"><button onClick={()=>saveEdit(team)} className="p-1.5 rounded bg-green-500/20 text-green-400"><Save size={14}/></button><button onClick={()=>setEditingId(null)} className="p-1.5 rounded bg-white/10 text-slate-400"><X size={14}/></button></div></div></div>:<div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3 flex-1 min-w-0"><div className="w-7 h-7 rounded-full flex-shrink-0 text-white text-xs flex items-center justify-center font-bold" style={{backgroundColor:team.school?.primary_color||'#334155'}}>{team.school?.school_name?.[0]}</div><div className="min-w-0"><p className="text-white text-sm font-medium truncate">{team.school?.school_name}</p><div className="flex items-center gap-2 flex-wrap"><p className="text-xs text-slate-400">{genderIcon(team.sport?.gender)} {team.sport?.sport_name}</p>{cls&&<span className="text-xs px-1.5 py-0.5 rounded bg-ice/10 text-ice border border-ice/20">Class {cls}</span>}{div&&<span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10">{div}</span>}{!cls&&!div&&hasEntry&&<span className="text-xs text-slate-600 italic">no class/div set</span>}</div></div></div><div className="flex items-center gap-2 flex-shrink-0"><button onClick={()=>startEdit(team)} className="p-1.5 text-slate-500 hover:text-white rounded"><Edit2 size={14}/></button><button onClick={()=>toggleTeamSeason(team)} className={`flex items-center gap-1 text-sm ${isActive?'text-green-400':'text-slate-500 hover:text-slate-300'}`}>{isActive?<ToggleRight size={22}/>:<ToggleLeft size={22}/>}<span className="text-xs hidden sm:inline w-16">{isActive?'Active':hasEntry?'Inactive':'Not Added'}</span></button></div></div>}</div>})}</div></>}
  </div>
}
