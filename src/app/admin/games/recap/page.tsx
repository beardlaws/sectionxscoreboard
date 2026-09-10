'use client'
import { useState, useEffect } from 'react'
import { Save, Search } from 'lucide-react'
import AdminLayout from '@/components/layout/AdminLayout'

export default function GameRecapPage() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedGame, setSelectedGame] = useState<any>(null)
  const [recap, setRecap] = useState('')
  const [author, setAuthor] = useState('Section X Scoreboard')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res=await fetch('/api/admin/games/recaps',{credentials:'include',cache:'no-store'})
      const json=await res.json().catch(()=>({}))
      if(!res.ok)throw new Error(json.error||'Could not load games')
      setGames(json.games||[])
    } catch(e:any) { alert(e.message||'Could not load games') }
    finally { setLoading(false) }
  }

  function selectGame(game: any) {
    setSelectedGame(game)
    setRecap(game.recap || '')
    setAuthor(game.recap_author || 'Section X Scoreboard')
    setSaved(false)
  }

  async function saveRecap() {
    if (!selectedGame) return
    setSaving(true)
    try {
      const res=await fetch('/api/admin/games/recaps',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selectedGame.id,recap,recap_author:author})})
      const json=await res.json().catch(()=>({}))
      if(!res.ok)throw new Error(json.error||'Could not save recap')
      setGames(prev => prev.map((g:any)=>g.id===selectedGame.id?{...g,recap,recap_author:author}:g))
      setSelectedGame((g:any)=>g?{...g,recap,recap_author:author}:g)
      setSaved(true)
      setTimeout(()=>setSaved(false),2000)
    } catch(e:any) { alert(e.message||'Could not save recap') }
    finally { setSaving(false) }
  }

  const filtered = games.filter((g:any)=>{
    if(!search)return true
    const q=search.toLowerCase(),ht=g.home_team?.school?.school_name||g.home_team?.team_name||'',at=g.away_team?.school?.school_name||g.away_team?.team_name||''
    return ht.toLowerCase().includes(q)||at.toLowerCase().includes(q)
  })

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold font-display text-white mb-1">Game Recaps</h1>
        <p className="text-slate-400 text-sm mb-5">Write a recap for any final game. Shows on the public game page.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="relative mb-3"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search teams..." className="input w-full pl-8"/></div>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {loading?<div className="text-center py-8 text-slate-500">Loading...</div>:filtered.map((game:any)=>{const ht=game.home_team?.school?.school_name||game.home_team?.team_name||'?',at=game.away_team?.school?.school_name||game.away_team?.team_name||'?',isSel=selectedGame?.id===game.id;return <button key={game.id} onClick={()=>selectGame(game)} className={`w-full text-left rounded-xl px-3 py-2.5 transition-all border ${isSel?'border-blue-500/40 bg-blue-500/10':'border-white/6 hover:border-white/12 bg-white/[0.02]'}`}><div className="flex items-center justify-between gap-2"><div><p className="text-sm font-semibold text-white" style={{fontFamily:'var(--font-display)'}}>{at} at {ht}</p><p className="text-xs text-slate-500 mt-0.5">{game.sport?.sport_name} · {game.game_date} · <span className="font-mono">{game.away_score}–{game.home_score}</span></p></div>{game.recap&&<span className="text-xs text-green-400">✓</span>}</div></button>})}
            </div>
          </div>
          <div>
            {selectedGame?<div className="card p-4 space-y-4"><div><h3 className="text-white font-bold" style={{fontFamily:'var(--font-display)'}}>{selectedGame.away_team?.school?.school_name||selectedGame.away_team?.team_name} at {selectedGame.home_team?.school?.school_name||selectedGame.home_team?.team_name}</h3><p className="text-xs text-slate-500">{selectedGame.sport?.sport_name} · {selectedGame.game_date}</p></div><div><label className="label">Recap</label><textarea value={recap} onChange={e=>setRecap(e.target.value)} rows={7} placeholder="Who stood out? What was the key moment? How did it end?" className="input w-full resize-none"/><p className="text-xs text-slate-600 mt-1">{recap.length} chars</p></div><div><label className="label">Author</label><input value={author} onChange={e=>setAuthor(e.target.value)} className="input w-full"/></div><button onClick={saveRecap} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2"><Save size={14}/>{saving?'Saving...':saved?'✓ Saved!':'Save Recap'}</button></div>:<div className="card p-8 text-center text-slate-600"><p className="text-3xl mb-2">📝</p><p className="text-sm">Select a game to write a recap</p></div>}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
