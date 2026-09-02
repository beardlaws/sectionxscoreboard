import AdminLayout from '@/components/layout/AdminLayout'
import { createAdminClient } from '@/lib/supabase/server'

export const revalidate = 0

function since(hours:number) { return new Date(Date.now() - hours * 3600000).toISOString() }
function shortPath(path:string) { return path.length > 64 ? `${path.slice(0,61)}...` : path }

export default async function TrafficPage() {
  const db = createAdminClient()
  const day = since(24)
  const week = since(24 * 7)

  const [{ data: today }, { data: sevenDays }] = await Promise.all([
    db.from('site_traffic_events').select('path,visitor_id,session_id,referrer_host,occurred_at').eq('is_bot', false).gte('occurred_at', day).order('occurred_at', { ascending: false }).limit(10000),
    db.from('site_traffic_events').select('path,visitor_id,session_id,referrer_host,occurred_at').eq('is_bot', false).gte('occurred_at', week).order('occurred_at', { ascending: false }).limit(30000),
  ])

  const rows = today || []
  const weekRows = sevenDays || []
  const unique = (key:'visitor_id'|'session_id', data:any[]) => new Set(data.map(r => r[key]).filter(Boolean)).size
  const countBy = (key:'path'|'referrer_host', data:any[]) => {
    const map = new Map<string,number>()
    for (const row of data) {
      const value = row[key]
      if (!value) continue
      map.set(value, (map.get(value) || 0) + 1)
    }
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12)
  }

  const cards = [
    ['Pageviews · 24h', rows.length.toLocaleString()],
    ['Visitors · 24h', unique('visitor_id', rows).toLocaleString()],
    ['Sessions · 24h', unique('session_id', rows).toLocaleString()],
    ['Pageviews · 7d', weekRows.length.toLocaleString()],
    ['Visitors · 7d', unique('visitor_id', weekRows).toLocaleString()],
    ['Sessions · 7d', unique('session_id', weekRows).toLocaleString()],
  ]

  return <AdminLayout><div className="p-4 max-w-6xl">
    <div className="mb-6"><h1 className="text-2xl font-bold text-white" style={{fontFamily:'var(--font-display)'}}>Traffic</h1><p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>First-party Section X traffic · bots and admin pages excluded</p></div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-7">{cards.map(([label,value])=><div key={label} className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}><div className="text-2xl font-black text-white">{value}</div><div className="text-xs mt-1" style={{color:'var(--text-muted)'}}>{label}</div></div>)}</div>
    <div className="grid md:grid-cols-2 gap-5">
      <section className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}><h2 className="font-bold text-white mb-3">Top Pages · 24h</h2>{countBy('path',rows).length ? countBy('path',rows).map(([path,count],i)=><div key={path} className="flex gap-3 justify-between py-2 text-sm" style={{borderBottom:'1px solid rgba(255,255,255,.05)'}}><span className="min-w-0" style={{color:'var(--text-secondary)'}}>{i+1}. {shortPath(path)}</span><b className="text-white">{count}</b></div>) : <p className="text-sm" style={{color:'var(--text-muted)'}}>Collection has just started. Traffic will appear here as visitors browse the site.</p>}</section>
      <section className="rounded-xl p-4" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}><h2 className="font-bold text-white mb-3">Top Referrers · 7d</h2>{countBy('referrer_host',weekRows).length ? countBy('referrer_host',weekRows).map(([host,count],i)=><div key={host} className="flex gap-3 justify-between py-2 text-sm" style={{borderBottom:'1px solid rgba(255,255,255,.05)'}}><span style={{color:'var(--text-secondary)'}}>{i+1}. {host}</span><b className="text-white">{count}</b></div>) : <p className="text-sm" style={{color:'var(--text-muted)'}}>No external referrals recorded yet. Direct traffic does not appear in this list.</p>}</section>
    </div>
    <p className="text-xs mt-5" style={{color:'var(--text-muted)'}}>Visitors use a first-party anonymous browser ID. Sessions expire after 30 minutes of inactivity. No IP addresses are stored.</p>
  </div></AdminLayout>
}
