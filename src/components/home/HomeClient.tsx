'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'

type DayKey = 'yesterday' | 'today' | 'tomorrow'
type Props = {
  activeSeason:any|null
  yesterdayGames:any[]
  todayGames:any[]
  tomorrowGames:any[]
  recentGames:any[]
  featuredGame:any|null
  homepageSponsor:any|null
  schools:any[]
  today:string
  featuredSpotlight:any|null
  featuredAthlete:any|null
  allSpotlights:any[]
}

function sportName(game:any) {
  const sport = game?.sport
  if (!sport) return 'Section X'
  const name = String(sport.sport_name || 'Sport')
  const gender = String(sport.gender || '')
  return gender && !name.toLowerCase().startsWith(gender.toLowerCase()) ? `${gender} ${name}` : name
}

function formatGameTime(value:any) {
  const raw = String(value || '').trim()
  if (!raw) return 'TBD'
  const match = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return raw
  let hour = Number(match[1])
  const minute = match[2]
  const suffix = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${suffix}`
}

function schoolFor(game:any, side:'home'|'away') {
  return game?.[`${side}_team`]?.school || null
}

function teamName(game:any, side:'home'|'away') {
  const school = schoolFor(game, side)
  if (school?.school_name) return school.school_name
  const external = game?.[`external_${side}`]
  return external?.name || external?.opponent_name || 'TBD'
}

function score(game:any, side:'home'|'away') {
  const value = game?.[`${side}_score`]
  return value === null || value === undefined ? null : value
}

function isLive(game:any) {
  const s = String(game?.status || '').toLowerCase()
  return s === 'live' || s === 'in progress'
}

function isFinal(game:any) {
  return String(game?.status || '').toLowerCase() === 'final'
}

function statusLabel(game:any) {
  if (isLive(game)) return game?.period_detail || game?.clock || 'LIVE'
  if (isFinal(game)) return 'FINAL'
  const s = String(game?.status || '')
  if (s && s.toLowerCase() !== 'scheduled') return s.toUpperCase()
  return formatGameTime(game?.game_time)
}

function SchoolMark({ school, size='md' }:{school:any;size?:'sm'|'md'|'lg'}) {
  const px = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const initials = String(school?.school_name || '?').split(/\s+/).filter(Boolean).slice(0,2).map((x:string)=>x[0]).join('').toUpperCase()
  return <div className={`${px} rounded-xl flex items-center justify-center overflow-hidden shrink-0`} style={{background:'linear-gradient(145deg,rgba(255,255,255,.1),rgba(255,255,255,.025))',border:'1px solid rgba(255,255,255,.10)',boxShadow:'0 10px 30px rgba(0,0,0,.22)'}}>
    {school?.logo_url ? <img src={school.logo_url} alt="" className="w-[82%] h-[82%] object-contain"/> : <span className="font-black text-[10px] text-white/70">{initials}</span>}
  </div>
}

function ScoreRailCard({game}:{game:any}) {
  const home = schoolFor(game,'home')
  const away = schoolFor(game,'away')
  const hs = score(game,'home')
  const as = score(game,'away')
  const live = isLive(game)
  const final = isFinal(game)
  return <Link href={`/game-center/${game.id}`} className="group min-w-[278px] sm:min-w-[310px] rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1" style={{background:'linear-gradient(145deg,rgba(18,24,38,.98),rgba(8,12,20,.98))',border:live?'1px solid rgba(250,204,21,.55)':'1px solid rgba(255,255,255,.08)',boxShadow:live?'0 16px 50px rgba(250,204,21,.10)':'0 16px 45px rgba(0,0,0,.28)'}}>
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="text-[10px] font-black uppercase tracking-[.16em] text-white/45 truncate">{sportName(game)}</div>
      <div className={`text-[10px] font-black uppercase tracking-[.12em] ${live?'text-yellow-300':final?'text-emerald-400':'text-blue-300'}`}>{statusLabel(game)}</div>
    </div>
    <div className="space-y-2.5">
      <TeamLine school={away} name={teamName(game,'away')} value={as} winner={final&&as!==null&&hs!==null&&as>hs}/>
      <TeamLine school={home} name={teamName(game,'home')} value={hs} winner={final&&as!==null&&hs!==null&&hs>as}/>
    </div>
    <div className="mt-3 pt-3 flex items-center justify-between text-[10px]" style={{borderTop:'1px solid rgba(255,255,255,.06)',color:'rgba(255,255,255,.38)'}}>
      <span className="truncate max-w-[210px]">{game?.location || (home?.school_name ? `at ${home.school_name}` : 'Section X')}</span>
      <span className="text-white/45 group-hover:text-yellow-300 transition-colors">GAME CENTER →</span>
    </div>
  </Link>
}

function TeamLine({school,name,value,winner}:{school:any;name:string;value:any;winner:boolean}) {
  return <div className="flex items-center gap-2.5 min-w-0">
    <SchoolMark school={school} size="sm"/>
    <div className={`flex-1 text-sm truncate ${winner?'font-black text-white':'font-semibold text-white/82'}`}>{name}</div>
    <div className={`text-xl tabular-nums ${winner?'font-black text-white':'font-bold text-white/70'}`}>{value===null||value===undefined?'—':value}</div>
  </div>
}

function SectionTitle({eyebrow,title,action,href}:{eyebrow?:string;title:string;action?:string;href?:string}) {
  return <div className="flex items-end justify-between gap-4 mb-4">
    <div>
      {eyebrow&&<div className="text-[10px] font-black uppercase tracking-[.20em] text-yellow-300/70 mb-1.5">{eyebrow}</div>}
      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{title}</h2>
    </div>
    {action&&href&&<Link href={href} className="text-[11px] font-black text-blue-300 hover:text-yellow-300 transition-colors whitespace-nowrap">{action} →</Link>}
  </div>
}

function EmptyRail({label}:{label:string}) {
  return <div className="rounded-2xl px-5 py-8 text-center min-w-full" style={{background:'rgba(255,255,255,.025)',border:'1px dashed rgba(255,255,255,.10)'}}>
    <div className="text-sm font-bold text-white/60">No {label.toLowerCase()} games on the board yet.</div>
    <div className="text-xs text-white/30 mt-1">Schedules update as schools publish changes.</div>
  </div>
}

function MiniFinal({game}:{game:any}) {
  const away = teamName(game,'away'), home = teamName(game,'home')
  const as = score(game,'away'), hs = score(game,'home')
  return <Link href={`/game-center/${game.id}`} className="flex items-center gap-3 rounded-xl p-3 transition-all hover:bg-white/[.045]" style={{border:'1px solid rgba(255,255,255,.055)'}}>
    <div className="w-16 shrink-0">
      <div className="text-[9px] uppercase tracking-[.10em] text-white/30">{sportName(game)}</div>
      <div className="text-[10px] font-black text-emerald-400 mt-0.5">FINAL</div>
    </div>
    <div className="flex-1 min-w-0 text-xs">
      <div className={`truncate ${as!==null&&hs!==null&&as>hs?'font-black text-white':'text-white/65'}`}>{away}</div>
      <div className={`truncate mt-1 ${as!==null&&hs!==null&&hs>as?'font-black text-white':'text-white/65'}`}>{home}</div>
    </div>
    <div className="text-right tabular-nums text-sm font-black text-white">
      <div>{as ?? '—'}</div><div className="mt-0.5">{hs ?? '—'}</div>
    </div>
  </Link>
}

export default function HomeClient({activeSeason,yesterdayGames,todayGames,tomorrowGames,recentGames,featuredGame,homepageSponsor,schools,today,featuredSpotlight,featuredAthlete,allSpotlights}:Props) {
  const [day,setDay] = useState<DayKey>('today')
  const [sport,setSport] = useState('All')
  const railRef = useRef<HTMLDivElement|null>(null)

  const dayGames = day==='yesterday'?yesterdayGames:day==='tomorrow'?tomorrowGames:todayGames
  const sportOptions = useMemo(()=>{
    const set = new Set<string>()
    ;[...yesterdayGames,...todayGames,...tomorrowGames].forEach(g=>set.add(sportName(g)))
    return ['All',...Array.from(set).sort()]
  },[yesterdayGames,todayGames,tomorrowGames])
  const visibleGames = useMemo(()=>dayGames.filter(g=>sport==='All'||sportName(g)===sport),[dayGames,sport])
  const liveNow = todayGames.filter(isLive)
  const todayFinals = todayGames.filter(isFinal)
  const upcomingToday = todayGames.filter(g=>!isLive(g)&&!isFinal(g))
  const latestFinals = recentGames.filter(isFinal).slice(0,8)
  const headline = liveNow.length ? `${liveNow.length} game${liveNow.length===1?'':'s'} live right now` : todayGames.length ? `${todayGames.length} game${todayGames.length===1?'':'s'} on today's board` : `${activeSeason?.name || 'Section X'} is live`

  function nudge(direction:number){railRef.current?.scrollBy({left:direction*330,behavior:'smooth'})}

  return <div className="min-h-screen pb-24 md:pb-10" style={{background:'radial-gradient(circle at 50% -180px, rgba(250,204,21,.09), transparent 34%), #060910'}}>
    <section className="relative overflow-hidden border-b border-white/[.06]">
      <div className="absolute inset-0 pointer-events-none" style={{background:'linear-gradient(115deg,rgba(250,204,21,.055),transparent 37%,rgba(37,99,235,.055))'}}/>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-7 sm:pt-10 pb-6 relative">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-4" style={{background:'rgba(250,204,21,.08)',border:'1px solid rgba(250,204,21,.17)'}}>
              <span className={`h-1.5 w-1.5 rounded-full ${liveNow.length?'animate-pulse':'opacity-60'}`} style={{background:'#facc15'}}/>
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[.18em] text-yellow-200">Section X Live</span>
            </div>
            <h1 className="text-[2.45rem] sm:text-6xl lg:text-7xl font-black leading-[.92] text-white tracking-[-.045em]">North Country sports.<br/><span className="text-transparent bg-clip-text" style={{backgroundImage:'linear-gradient(90deg,#fde047,#facc15 45%,#60a5fa)'}}>Right now.</span></h1>
            <p className="mt-4 text-sm sm:text-base text-white/45 max-w-2xl">Scores, schedules, standings, schools and stories from across Section X, built for the people who actually follow it.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[360px]">
            <HeroStat label="Live" value={liveNow.length} tone="yellow"/>
            <HeroStat label="Final" value={todayFinals.length} tone="green"/>
            <HeroStat label="Next" value={upcomingToday.length} tone="blue"/>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl px-4 py-3" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.06)'}}>
          <div className="text-sm font-black text-white/85">{headline}</div>
          <Link href="/scores" className="text-[10px] sm:text-xs font-black uppercase tracking-[.10em] text-yellow-300 whitespace-nowrap">Full scoreboard →</Link>
        </div>
      </div>
    </section>

    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-10">
      <section id="scores">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-4">
          <SectionTitle eyebrow="Scoreboard" title="What’s happening"/>
          <div className="flex flex-wrap gap-2">
            {(['yesterday','today','tomorrow'] as DayKey[]).map(key=><button key={key} onClick={()=>setDay(key)} className="rounded-full px-3.5 py-2 text-[10px] font-black uppercase tracking-[.09em] transition-all" style={{background:day===key?'#facc15':'rgba(255,255,255,.04)',color:day===key?'#080b12':'rgba(255,255,255,.50)',border:day===key?'1px solid #fde047':'1px solid rgba(255,255,255,.07)'}}>{key}</button>)}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {sportOptions.map(name=><button key={name} onClick={()=>setSport(name)} className="shrink-0 rounded-lg px-3 py-2 text-[10px] font-bold transition-all" style={{background:sport===name?'rgba(59,130,246,.18)':'rgba(255,255,255,.025)',color:sport===name?'#93c5fd':'rgba(255,255,255,.40)',border:sport===name?'1px solid rgba(96,165,250,.35)':'1px solid rgba(255,255,255,.055)'}}>{name}</button>)}
        </div>
        <div className="relative mt-1">
          <div ref={railRef} className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">{visibleGames.length?visibleGames.map(game=><div key={game.id} className="snap-start"><ScoreRailCard game={game}/></div>):<EmptyRail label={day}/>}</div>
          {visibleGames.length>2&&<div className="hidden lg:flex gap-2 absolute -top-12 right-0"><button onClick={()=>nudge(-1)} className="h-8 w-8 rounded-lg text-white/45 hover:text-white" style={{border:'1px solid rgba(255,255,255,.08)'}}>←</button><button onClick={()=>nudge(1)} className="h-8 w-8 rounded-lg text-white/45 hover:text-white" style={{border:'1px solid rgba(255,255,255,.08)'}}>→</button></div>}
        </div>
      </section>

      <section id="schools">
        <SectionTitle eyebrow="24 member schools" title="Your school. Your teams." action="View all schools" href="/schools"/>
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x scrollbar-hide">
          {schools.map(school=><Link key={school.id} href={`/schools/${school.slug}`} className="group min-w-[118px] sm:min-w-[138px] snap-start rounded-2xl p-4 text-center transition-all duration-300 hover:-translate-y-1" style={{background:'linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.015))',border:'1px solid rgba(255,255,255,.065)'}}>
            <div className="mx-auto w-fit group-hover:scale-105 transition-transform"><SchoolMark school={school} size="lg"/></div>
            <div className="mt-3 text-xs font-black leading-tight text-white/78 line-clamp-2">{school.school_name?.replace(' Central School','').replace(' Central High School','')}</div>
            {school.mascot&&<div className="mt-1 text-[9px] uppercase tracking-[.10em] text-white/28">{school.mascot}</div>}
          </Link>)}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-[1.45fr_.8fr] gap-5">
        <div className="rounded-3xl p-4 sm:p-5" style={{background:'linear-gradient(145deg,rgba(18,24,38,.90),rgba(8,12,20,.96))',border:'1px solid rgba(255,255,255,.07)'}}>
          <SectionTitle eyebrow="Latest results" title="Final scores" action="All scores" href="/scores"/>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{latestFinals.length?latestFinals.map(game=><MiniFinal key={game.id} game={game}/>):<div className="text-sm text-white/35 py-8">Final scores will appear here as games finish.</div>}</div>
        </div>
        <div className="space-y-5">
          {featuredGame&&<FeatureGame game={featuredGame}/>} 
          <QuickLinks/>
        </div>
      </section>

      <section id="stories" className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-3xl overflow-hidden relative min-h-[330px]" style={{background:'linear-gradient(135deg,rgba(250,204,21,.12),rgba(13,18,29,.96) 48%,rgba(37,99,235,.12))',border:'1px solid rgba(255,255,255,.07)'}}>
          <div className="p-6 sm:p-8 flex flex-col h-full min-h-[330px] justify-end">
            <div className="text-[10px] font-black uppercase tracking-[.20em] text-yellow-300/75">Section X Spotlight</div>
            <h2 className="text-2xl sm:text-4xl font-black text-white max-w-2xl mt-2 leading-tight">{featuredSpotlight?.title || allSpotlights?.[0]?.title || 'The stories behind Section X sports.'}</h2>
            <p className="text-sm text-white/42 mt-3 max-w-2xl line-clamp-3">{featuredSpotlight?.body || allSpotlights?.[0]?.body || 'History, teams, athletes and the moments people around the North Country still talk about.'}</p>
            <Link href={featuredSpotlight?.id?`/spotlight/${featuredSpotlight.id}`:'/spotlight'} className="mt-5 w-fit rounded-xl px-4 py-2.5 text-xs font-black bg-yellow-300 text-black">READ THE STORY →</Link>
          </div>
        </div>
        <div className="rounded-3xl p-5 sm:p-6" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.065)'}}>
          <div className="text-[10px] font-black uppercase tracking-[.20em] text-blue-300/75">Athlete of the Week</div>
          {featuredAthlete?<>
            <div className="mt-5 flex items-center gap-4"><SchoolMark school={featuredAthlete.school} size="lg"/><div><div className="text-xl font-black text-white">{featuredAthlete.athlete_name || featuredAthlete.name}</div><div className="text-xs text-white/38 mt-1">{featuredAthlete.school?.school_name}</div></div></div>
            {featuredAthlete.sport&&<div className="mt-5 text-xs font-bold text-yellow-300">{featuredAthlete.sport}</div>}
            {featuredAthlete.description&&<p className="mt-3 text-sm leading-relaxed text-white/45 line-clamp-5">{featuredAthlete.description}</p>}
            <Link href="/athlete-of-week" className="inline-block mt-5 text-xs font-black text-blue-300">MEET THIS WEEK'S ATHLETE →</Link>
          </>:<div className="mt-5 text-sm text-white/35">The next Section X Athlete of the Week will appear here.</div>}
        </div>
      </section>

      {homepageSponsor&&<section className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.055)'}}><div><div className="text-[9px] uppercase tracking-[.16em] text-white/24">Section X Scoreboard partner</div><div className="text-sm font-bold text-white/65 mt-1">{homepageSponsor.name || homepageSponsor.sponsor_name}</div></div>{homepageSponsor.website_url&&<a href={homepageSponsor.website_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-blue-300">VISIT PARTNER →</a>}</section>}
    </main>

    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)]" style={{background:'rgba(6,9,16,.94)',backdropFilter:'blur(18px)',borderTop:'1px solid rgba(255,255,255,.08)'}}>
      <div className="grid grid-cols-4 gap-1">
        <MobileNav href="/scores" label="Scores"/><MobileNav href="/schools" label="Schools"/><MobileNav href="/standings" label="Standings"/><MobileNav href="/playoffs" label="Playoffs"/>
      </div>
    </nav>
  </div>
}

function HeroStat({label,value,tone}:{label:string;value:number;tone:'yellow'|'green'|'blue'}) {
  const color = tone==='yellow'?'#fde047':tone==='green'?'#4ade80':'#60a5fa'
  return <div className="rounded-2xl p-3 sm:p-4 text-center" style={{background:'rgba(255,255,255,.028)',border:'1px solid rgba(255,255,255,.07)'}}><div className="text-2xl sm:text-3xl font-black" style={{color}}>{value}</div><div className="text-[9px] sm:text-[10px] uppercase tracking-[.12em] text-white/30 mt-1">{label}</div></div>
}

function FeatureGame({game}:{game:any}) {
  return <Link href={`/game-center/${game.id}`} className="block rounded-3xl p-5 transition-all hover:-translate-y-1" style={{background:'linear-gradient(135deg,rgba(250,204,21,.11),rgba(18,24,38,.96))',border:'1px solid rgba(250,204,21,.16)'}}><div className="text-[9px] uppercase tracking-[.18em] font-black text-yellow-300/70">Game to watch</div><div className="mt-3 text-lg font-black text-white leading-tight">{teamName(game,'away')} <span className="text-white/25">at</span> {teamName(game,'home')}</div><div className="mt-3 text-xs text-white/38">{sportName(game)} · {formatGameTime(game.game_time)}</div><div className="mt-4 text-[10px] font-black text-yellow-300">OPEN GAME CENTER →</div></Link>
}

function QuickLinks() {
  return <div className="grid grid-cols-2 gap-2"><Quick href="/standings" title="Standings" sub="See who's on top"/><Quick href="/playoffs" title="Playoffs" sub="Brackets & road ahead"/><Quick href="/sports" title="Sports" sub="Browse every sport"/><Quick href="/spotlight" title="Stories" sub="Section X Spotlight"/></div>
}
function Quick({href,title,sub}:{href:string;title:string;sub:string}) {return <Link href={href} className="rounded-2xl p-4 hover:-translate-y-0.5 transition-transform" style={{background:'rgba(255,255,255,.025)',border:'1px solid rgba(255,255,255,.06)'}}><div className="text-sm font-black text-white/78">{title}</div><div className="text-[10px] text-white/28 mt-1">{sub}</div></Link>}
function MobileNav({href,label}:{href:string;label:string}) {return <Link href={href} className="rounded-xl py-2.5 text-center text-[10px] font-black uppercase tracking-[.08em] text-white/55 active:text-yellow-300 active:bg-white/[.04]">{label}</Link>}
