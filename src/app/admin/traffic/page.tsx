import AdminLayout from '@/components/layout/AdminLayout'
import { createAdminClient } from '@/lib/supabase/server'

export const revalidate = 0

type Point = { hour?: string; day?: string; pageviews: number; visitors?: number }
type TopPage = { path:string; title:string|null; pageviews:number; visitors:number }
type Referrer = { source:string; visits:number; visitors:number }
type ContentRow = { content_type:string; pageviews:number }

const n = (v:any) => Number(v || 0)
const pct = (a:number,b:number) => b > 0 ? Math.round(((a-b)/b)*100) : a > 0 ? 100 : 0
const niceTitle = (row:TopPage) => {
  const t = (row.title || '').replace(/\s*\|\s*Section X Scoreboard.*$/i,'').trim()
  if (t && !/^section x scoreboard$/i.test(t)) return t
  if (row.path === '/') return 'Home'
  return row.path
}
const sourceBadge = (source:string) => {
  if (source === 'North Country Now') return 'NCN'
  if (source === 'Instagram') return 'IG'
  if (source === 'Facebook') return 'FB'
  if (source === 'Google') return 'G'
  if (source === 'Direct / Unknown') return '↗'
  return '↗'
}

function MiniBars({points, labelKey}:{points:Point[];labelKey:'hour'|'day'}) {
  const max = Math.max(1,...points.map(p=>n(p.pageviews)))
  return <div className="flex items-end gap-1 h-36 pt-5">{points.map((p,i)=>{
    const value=n(p.pageviews)
    const height=Math.max(value?8:2,Math.round((value/max)*100))
    const label = labelKey==='hour'
      ? new Date(p.hour || '').toLocaleTimeString('en-US',{hour:'numeric',timeZone:'America/New_York'})
      : new Date(p.day || '').toLocaleDateString('en-US',{month:'numeric',day:'numeric',timeZone:'America/New_York'})
    return <div key={i} className="flex-1 min-w-0 flex flex-col justify-end h-full group relative">
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] whitespace-nowrap rounded px-2 py-1 z-10" style={{background:'#111827',border:'1px solid var(--border)',color:'#fff'}}>{label}: {value} views</div>
      <div className="w-full rounded-t transition-all" style={{height:`${height}%`,background:'linear-gradient(180deg,#60a5fa,#2563eb)',opacity:value?1:.16}} />
    </div>
  })}</div>
}

export default async function TrafficPage() {
  const db = createAdminClient()
  const { data, error } = await db.rpc('site_traffic_dashboard')
  const d:any = data || {}
  const s:any = d.summary || {}
  const hourly:Point[] = d.hourly || []
  const daily:Point[] = d.daily || []
  const topPages:TopPage[] = d.topPages || []
  const referrers:Referrer[] = d.referrers || []
  const content:ContentRow[] = d.content || []
  const audience:any = d.audience || {}
  const today=n(s.todayPageviews), yesterday=n(s.yesterdayPageviews)
  const todayChange=pct(today,yesterday)
  const pagesPerSession=n(s.weekSessions)>0?(n(s.weekPageviews)/n(s.weekSessions)).toFixed(1):'0.0'
  const topContentMax=Math.max(1,...content.map(x=>n(x.pageviews)))

  const cards = [
    {label:'Live now',value:n(s.last5m),sub:'visitors · last 5 min',accent:true},
    {label:'Today',value:today,sub:`pageviews · ${todayChange>=0?'+':''}${todayChange}% vs yesterday`},
    {label:'Today',value:n(s.todayVisitors),sub:'unique visitors'},
    {label:'7 days',value:n(s.weekPageviews),sub:'pageviews'},
    {label:'30 days',value:n(s.monthPageviews),sub:'pageviews'},
    {label:'All time',value:n(s.allPageviews),sub:'pageviews since tracking began'},
  ]

  return <AdminLayout><div className="p-4 md:p-6 max-w-7xl mx-auto">
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
      <div><div className="text-xs font-black uppercase tracking-[.22em] mb-1" style={{color:'#60a5fa'}}>Section X Intelligence</div><h1 className="text-3xl font-black text-white" style={{fontFamily:'var(--font-display)'}}>Traffic Command Center</h1><p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Real first-party traffic · bots and admin pages excluded · Eastern Time</p></div>
      <div className="text-xs rounded-full px-3 py-1.5 self-start md:self-auto" style={{background:'rgba(34,197,94,.08)',border:'1px solid rgba(34,197,94,.22)',color:'#86efac'}}>● LIVE COLLECTION</div>
    </div>

    {error && <div className="rounded-xl p-4 mb-5 text-sm" style={{background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.25)',color:'#fca5a5'}}>Analytics query error: {error.message}</div>}

    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">{cards.map(c=><div key={`${c.label}-${c.sub}`} className="rounded-2xl p-4" style={{background:c.accent?'linear-gradient(145deg,rgba(37,99,235,.16),rgba(15,23,42,.82))':'var(--bg-card)',border:c.accent?'1px solid rgba(96,165,250,.35)':'1px solid var(--border)'}}><div className="text-[10px] uppercase font-black tracking-[.18em]" style={{color:c.accent?'#93c5fd':'var(--text-muted)'}}>{c.label}</div><div className="text-3xl font-black text-white mt-1">{c.value.toLocaleString()}</div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{c.sub}</div></div>)}</div>

    <div className="grid xl:grid-cols-3 gap-5 mb-5">
      <section className="xl:col-span-2 rounded-2xl p-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-black text-white">Game-Day Pulse</h2><p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Pageviews by hour · last 24 hours</p></div><div className="text-right"><div className="text-xl font-black text-white">{n(s.todaySessions).toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider" style={{color:'var(--text-muted)'}}>sessions today</div></div></div>
        <MiniBars points={hourly} labelKey="hour" />
        <div className="flex justify-between text-[10px] mt-2" style={{color:'var(--text-muted)'}}><span>24h ago</span><span>Now</span></div>
      </section>

      <section className="rounded-2xl p-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
        <h2 className="font-black text-white">Audience Quality</h2><p className="text-xs mt-1 mb-4" style={{color:'var(--text-muted)'}}>Last 7 days</p>
        <div className="grid grid-cols-2 gap-3 mb-3"><div className="rounded-xl p-3" style={{background:'rgba(255,255,255,.025)'}}><div className="text-2xl font-black text-white">{n(s.weekVisitors).toLocaleString()}</div><div className="text-xs" style={{color:'var(--text-muted)'}}>unique visitors</div></div><div className="rounded-xl p-3" style={{background:'rgba(255,255,255,.025)'}}><div className="text-2xl font-black text-white">{pagesPerSession}</div><div className="text-xs" style={{color:'var(--text-muted)'}}>pages / session</div></div></div>
        <div className="rounded-xl p-3" style={{background:'rgba(255,255,255,.025)'}}><div className="flex justify-between text-xs mb-2"><span style={{color:'var(--text-secondary)'}}>New visitors</span><b className="text-white">{n(audience.newVisitors)}</b></div><div className="flex justify-between text-xs"><span style={{color:'var(--text-secondary)'}}>Returning visitors</span><b className="text-white">{n(audience.returningVisitors)}</b></div></div>
      </section>
    </div>

    <div className="grid xl:grid-cols-3 gap-5 mb-5">
      <section className="xl:col-span-2 rounded-2xl p-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
        <div><h2 className="font-black text-white">14-Day Growth</h2><p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Daily pageviews</p></div>
        <MiniBars points={daily} labelKey="day" />
        <div className="grid grid-cols-3 gap-2 mt-4"><div><div className="text-xl font-black text-white">{n(s.weekPageviews).toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider" style={{color:'var(--text-muted)'}}>7d views</div></div><div><div className="text-xl font-black text-white">{n(s.monthVisitors).toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider" style={{color:'var(--text-muted)'}}>30d visitors</div></div><div><div className="text-xl font-black text-white">{n(s.allVisitors).toLocaleString()}</div><div className="text-[10px] uppercase tracking-wider" style={{color:'var(--text-muted)'}}>all-time visitors</div></div></div>
      </section>

      <section className="rounded-2xl p-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}><h2 className="font-black text-white">What Fans Want</h2><p className="text-xs mt-1 mb-4" style={{color:'var(--text-muted)'}}>Content mix · last 7 days</p>{content.length?content.map(row=><div key={row.content_type} className="mb-3"><div className="flex justify-between text-xs mb-1"><span style={{color:'var(--text-secondary)'}}>{row.content_type}</span><b className="text-white">{n(row.pageviews).toLocaleString()}</b></div><div className="h-1.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.05)'}}><div className="h-full rounded-full" style={{width:`${Math.max(3,(n(row.pageviews)/topContentMax)*100)}%`,background:'#3b82f6'}}/></div></div>):<p className="text-sm" style={{color:'var(--text-muted)'}}>Traffic is just starting to build.</p>}</section>
    </div>

    <div className="grid xl:grid-cols-2 gap-5 mb-5">
      <section className="rounded-2xl p-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}><div className="flex items-center justify-between mb-3"><div><h2 className="font-black text-white">Top Pages</h2><p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Last 7 days</p></div><span className="text-[10px] uppercase tracking-wider" style={{color:'var(--text-muted)'}}>Views · Visitors</span></div>{topPages.length?topPages.map((row,i)=><div key={`${row.path}-${i}`} className="grid grid-cols-[28px_1fr_auto] gap-3 items-center py-2.5" style={{borderBottom:'1px solid rgba(255,255,255,.05)'}}><div className="text-xs font-black" style={{color:i<3?'#60a5fa':'var(--text-muted)'}}>#{i+1}</div><div className="min-w-0"><div className="text-sm font-semibold text-white truncate">{niceTitle(row)}</div><div className="text-[10px] truncate" style={{color:'var(--text-muted)'}}>{row.path}</div></div><div className="text-right"><div className="text-sm font-black text-white">{n(row.pageviews).toLocaleString()}</div><div className="text-[10px]" style={{color:'var(--text-muted)'}}>{n(row.visitors).toLocaleString()} visitors</div></div></div>):<p className="text-sm" style={{color:'var(--text-muted)'}}>No page data yet.</p>}</section>

      <section className="rounded-2xl p-5" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}><div className="flex items-center justify-between mb-3"><div><h2 className="font-black text-white">Traffic Sources</h2><p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Last 7 days · including direct traffic</p></div><span className="text-[10px] uppercase tracking-wider" style={{color:'var(--text-muted)'}}>Visits · Visitors</span></div>{referrers.length?referrers.map((row,i)=><div key={`${row.source}-${i}`} className="grid grid-cols-[34px_1fr_auto] gap-3 items-center py-2.5" style={{borderBottom:'1px solid rgba(255,255,255,.05)'}}><div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black" style={{background:'rgba(59,130,246,.10)',border:'1px solid rgba(59,130,246,.18)',color:'#93c5fd'}}>{sourceBadge(row.source)}</div><div><div className="text-sm font-semibold text-white">{row.source}</div>{row.source==='North Country Now'&&<div className="text-[10px]" style={{color:'#86efac'}}>LOCAL REFERRAL PARTNER</div>}</div><div className="text-right"><div className="text-sm font-black text-white">{n(row.visits).toLocaleString()}</div><div className="text-[10px]" style={{color:'var(--text-muted)'}}>{n(row.visitors).toLocaleString()} visitors</div></div></div>):<p className="text-sm" style={{color:'var(--text-muted)'}}>No sources recorded yet.</p>}</section>
    </div>

    <div className="rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2" style={{background:'rgba(59,130,246,.055)',border:'1px solid rgba(59,130,246,.16)'}}><div><div className="text-sm font-bold text-white">Sponsor-ready, first-party numbers</div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>Anonymous browser IDs only. No IP addresses stored. Sessions expire after 30 minutes. Raw analytics are private.</div></div><div className="text-xs font-bold" style={{color:'#93c5fd'}}>COLLECTING SINCE SEP 2, 2026</div></div>
  </div></AdminLayout>
}
