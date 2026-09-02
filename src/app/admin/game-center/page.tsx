'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw, Save, Search, SlidersHorizontal } from 'lucide-react'
import AdminLayout from '@/components/layout/AdminLayout'
import { createClient } from '@/lib/supabase/client'

const localDate = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const sourceLabel = (source: unknown) => source === 'arbiter-api' ? 'Reported by Arbiter' : source === 'manual' ? 'Entered manually' : source ? `Reported by ${String(source).replaceAll('-', ' ')}` : 'Source not recorded'

export default function GameCenterAdminIndex() {
  const supabase = createClient()
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [day, setDay] = useState('today')
  const [scores, setScores] = useState<Record<string, { away: string; home: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [showFinals, setShowFinals] = useState(false)
  const [showScrimmages, setShowScrimmages] = useState(false)
  const [checkingArbiter, setCheckingArbiter] = useState(false)
  const [arbiterMessage, setArbiterMessage] = useState('')

  const load = async () => {
    setLoading(true)
    const today = localDate()
    const yesterday = localDate(-1)
    const tomorrow = localDate(1)
    const start = day === 'yesterday' ? yesterday : day === 'tomorrow' ? tomorrow : day === 'today' ? today : localDate(-3)
    const end = day === 'yesterday' ? yesterday : day === 'tomorrow' ? tomorrow : day === 'today' ? today : localDate(3)

    const { data } = await supabase
      .from('games')
      .select(`
        id, game_date, game_time, status, home_score, away_score, recap, contest_type, source, verification_status,
        sport:sports(sport_name),
        home_team:teams!games_home_team_id_fkey(school:schools(school_name)),
        away_team:teams!games_away_team_id_fkey(school:schools(school_name)),
        external_home:external_opponents!games_external_home_opponent_id_fkey(name),
        external_away:external_opponents!games_external_away_opponent_id_fkey(name)
      `)
      .gte('game_date', start)
      .lte('game_date', end)
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true })
      .limit(250)

    setGames(data || [])
    const initial: Record<string, { away: string; home: string }> = {}
    for (const game of data || []) initial[game.id] = { away: game.away_score == null ? '' : String(game.away_score), home: game.home_score == null ? '' : String(game.home_score) }
    setScores(initial)
    setLoading(false)
  }

  useEffect(() => { load() }, [day])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? games.filter(game => {
      const home = game.home_team?.school?.school_name || game.external_home?.name || ''
      const away = game.away_team?.school?.school_name || game.external_away?.name || ''
      return home.toLowerCase().includes(q) || away.toLowerCase().includes(q) || (game.sport?.sport_name || '').toLowerCase().includes(q)
    }) : games
    return [...list].sort((a, b) => {
      const rank = (g: any) => g.status === 'Live' ? 0 : g.status === 'Scheduled' ? 1 : g.status === 'Final' ? 2 : 3
      return rank(a) - rank(b) || String(a.game_time || '99:99').localeCompare(String(b.game_time || '99:99'))
    })
  }, [games, search])

  const buckets = useMemo(() => {
    const scrimmages = filtered.filter(g => String(g.contest_type || '').toLowerCase() === 'scrimmage')
    const official = filtered.filter(g => String(g.contest_type || '').toLowerCase() !== 'scrimmage')
    const finals = official.filter(g => g.status === 'Final')
    const active = official.filter(g => g.status !== 'Final')
    return { active, finals, scrimmages }
  }, [filtered])

  const needsScore = (game: any) => {
    if (game.status !== 'Scheduled' || game.game_date >= localDate()) return false
    return game.home_score == null || game.away_score == null
  }

  async function saveFinal(game: any) {
    const current = scores[game.id] || { away: '', home: '' }
    if (current.away === '' || current.home === '') return alert('Enter both scores first.')
    if (!confirm(`Publish FINAL: ${current.away} - ${current.home}?`)) return
    setSaving(game.id)
    setSaved(null)
    const res = await fetch('/api/admin/quick-score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: game.id, away_score: current.away, home_score: current.home }),
    })
    const json = await res.json()
    if (!res.ok) alert(json.error || 'Score save failed.')
    else {
      setGames(prev => prev.map(g => g.id === game.id ? { ...g, away_score: Number(current.away), home_score: Number(current.home), status: 'Final', source: 'manual', verification_status: 'Reported' } : g))
      setSaved(game.id)
      setTimeout(() => setSaved(null), 2500)
    }
    setSaving(null)
  }

  async function checkArbiter() {
    setCheckingArbiter(true)
    setArbiterMessage('Checking Arbiter…')
    try {
      const res = await fetch('/api/admin/arbiter-pull', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Arbiter check failed.')
      setArbiterMessage(`Arbiter check complete${Number.isFinite(json.scoresUpdated) ? ` · ${json.scoresUpdated} score${json.scoresUpdated === 1 ? '' : 's'} updated` : ''}.`)
      await load()
    } catch (error) {
      setArbiterMessage(error instanceof Error ? error.message : 'Arbiter check failed.')
    } finally { setCheckingArbiter(false) }
  }

  const GameCard = ({ game, compact = false }: { game: any; compact?: boolean }) => {
    const home = game.home_team?.school?.school_name || game.external_home?.name || 'TBD'
    const away = game.away_team?.school?.school_name || game.external_away?.name || 'TBD'
    const current = scores[game.id] || { away: '', home: '' }
    const scrimmage = String(game.contest_type || '').toLowerCase() === 'scrimmage'
    const overdue = needsScore(game)
    return (
      <div className={`card p-4 ${overdue ? 'ring-1 ring-amber-400/50' : ''}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {overdue && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black">NEEDS SCORE</span>}
              <span className="uppercase tracking-widest text-blue-400 font-black">{game.sport?.sport_name || 'Sport'}</span>
              <span className="text-slate-500">{game.game_date}{game.game_time ? ` · ${String(game.game_time).slice(0,5)}` : ''}</span>
              <span className={`px-2 py-0.5 rounded-full ${game.status === 'Final' ? 'bg-emerald-500/15 text-emerald-300' : game.status === 'Live' ? 'bg-red-500/15 text-red-300' : 'bg-blue-500/15 text-blue-300'}`}>{game.status}</span>
            </div>
            {game.status === 'Final' && <div className="text-xs text-slate-500 mt-1">{sourceLabel(game.source)}{game.source === 'manual' ? ' · protected from automatic Arbiter disagreement' : ''}</div>}
          </div>
          <Link href={`/admin/game-center/${game.id}`} className="text-slate-500 hover:text-white" title="Advanced Game Center"><SlidersHorizontal size={17} /></Link>
        </div>
        <div className="grid grid-cols-[1fr_92px] gap-3 items-center mb-2"><div className="font-bold text-white truncate">{away}</div><input aria-label={`${away} score`} inputMode="numeric" type="number" min="0" value={current.away} disabled={scrimmage} onChange={e => setScores(p => ({ ...p, [game.id]: { ...current, away: e.target.value } }))} className="input text-center text-3xl font-black font-mono h-14" placeholder="—" /></div>
        <div className="grid grid-cols-[1fr_92px] gap-3 items-center"><div className="font-bold text-white truncate">{home}</div><input aria-label={`${home} score`} inputMode="numeric" type="number" min="0" value={current.home} disabled={scrimmage} onChange={e => setScores(p => ({ ...p, [game.id]: { ...current, home: e.target.value } }))} className="input text-center text-3xl font-black font-mono h-14" placeholder="—" /></div>
        <div className="mt-3 flex items-center gap-2">
          {scrimmage ? <div className="text-xs text-slate-500 flex-1">Scrimmage · informational only</div> : <button onClick={() => saveFinal(game)} disabled={saving === game.id} className="btn-primary flex-1 h-11 flex items-center justify-center gap-2 font-black"><Save size={16} />{saving === game.id ? 'Saving...' : game.status === 'Final' ? 'Update Final' : 'Publish Final'}</button>}
          <Link href={`/game-center/${game.id}`} target="_blank" className="btn-ghost h-11 px-3 flex items-center"><ExternalLink size={16} /></Link>
        </div>
        {saved === game.id && <div className="mt-2 text-center text-xs font-bold text-emerald-400">Final saved.</div>}
      </div>
    )
  }

  return (
    <AdminLayout><div className="p-3 md:p-6 max-w-5xl mx-auto">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><div className="text-xs uppercase tracking-[0.18em] text-blue-400 font-black mb-1">Game Day</div><h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Score Desk</h1><p className="text-sm text-slate-400 mt-1">Unreported official games stay front and center. Finals and scrimmages get out of your way.</p></div>
        <button onClick={checkArbiter} disabled={checkingArbiter} className="btn-ghost shrink-0 h-10 px-3 flex items-center gap-2 text-xs font-black"><RefreshCw size={15} className={checkingArbiter ? 'animate-spin' : ''} />{checkingArbiter ? 'Checking…' : 'Check Arbiter Now'}</button>
      </div>
      {arbiterMessage && <div className="mb-3 text-xs text-slate-400">{arbiterMessage}</div>}
      <div className="grid grid-cols-4 gap-2 mb-3">{[['yesterday','Yesterday'],['today','Today'],['tomorrow','Tomorrow'],['nearby','±3 Days']].map(([value,label]) => <button key={value} onClick={() => setDay(value)} className={`rounded-lg px-2 py-2 text-xs md:text-sm font-bold border ${day === value ? 'bg-blue-500/20 border-blue-400/50 text-blue-200' : 'bg-white/5 border-white/10 text-slate-400'}`}>{label}</button>)}</div>
      <div className="relative mb-4"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input className="input w-full pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search school or sport..." /></div>
      {loading ? <div className="card p-10 text-center text-slate-500">Loading games...</div> : filtered.length === 0 ? <div className="card p-10 text-center text-slate-500">No games in this window.</div> : <div className="space-y-4">
        <section><div className="flex items-center justify-between mb-2"><h2 className="text-sm font-black text-white">Needs Attention <span className="text-slate-500">({buckets.active.length})</span></h2></div>{buckets.active.length ? <div className="space-y-3">{[...buckets.active].sort((a,b) => Number(needsScore(b))-Number(needsScore(a))).map(game => <GameCard key={game.id} game={game} />)}</div> : <div className="card p-5 text-center text-sm text-emerald-300">All official games in this window have reported finals.</div>}</section>
        {buckets.finals.length > 0 && <section><button onClick={() => setShowFinals(v => !v)} className="w-full card px-4 py-3 flex items-center justify-between text-left"><span className="font-black text-sm text-slate-300">Finals Reported ({buckets.finals.length})</span>{showFinals ? <ChevronDown size={17}/> : <ChevronRight size={17}/>}</button>{showFinals && <div className="space-y-3 mt-3">{buckets.finals.map(game => <GameCard key={game.id} game={game} compact />)}</div>}</section>}
        {buckets.scrimmages.length > 0 && <section><button onClick={() => setShowScrimmages(v => !v)} className="w-full card px-4 py-3 flex items-center justify-between text-left"><span className="font-black text-sm text-slate-400">Scrimmages ({buckets.scrimmages.length})</span>{showScrimmages ? <ChevronDown size={17}/> : <ChevronRight size={17}/>}</button>{showScrimmages && <div className="space-y-3 mt-3">{buckets.scrimmages.map(game => <GameCard key={game.id} game={game} compact />)}</div>}</section>}
      </div>}
    </div></AdminLayout>
  )
}
