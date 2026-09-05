// src/components/SponsorDisplay.tsx
'use client'
import { useEffect, useRef } from 'react'

interface Sponsor {
  id: string
  business_name: string
  website_url?: string | null
  tagline?: string | null
  logo_url?: string | null
  placement_type?: string
}

interface Props {
  sponsor: Sponsor
  placement: string
  pagePath: string
  variant?: 'hero' | 'banner' | 'card' | 'compact'
}

type SponsorEvent = 'served' | 'viewable' | 'click'

function dedupeKey(event: SponsorEvent, sponsorId: string, pagePath: string, placement: string) {
  return `sx-sponsor:${event}:${sponsorId}:${placement}:${pagePath}`
}

type QueuedSponsorEvent = { event: SponsorEvent; sponsor_id: string; page_path: string; placement_type: string }

let pendingEvents: QueuedSponsorEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function flushSponsorEvents(keepalive = false) {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  if (!pendingEvents.length) return Promise.resolve(undefined)

  const events = pendingEvents
  pendingEvents = []
  return fetch('/api/sponsor-track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
    keepalive,
  }).catch(() => undefined)
}

function queueSponsorEvent(payload: QueuedSponsorEvent, immediate = false) {
  pendingEvents.push(payload)
  if (immediate) return flushSponsorEvents(true)
  if (!flushTimer) flushTimer = setTimeout(() => flushSponsorEvents(false), 1500)
  return Promise.resolve(undefined)
}

function track(event: SponsorEvent, sponsorId: string, pagePath: string, placement: string) {
  // Count served/viewable once per browser session for each sponsor placement.
  // The short queue batches the typical served + viewable pair into one request
  // without changing either measurement definition.
  if (event !== 'click') {
    try {
      const key = dedupeKey(event, sponsorId, pagePath, placement)
      if (sessionStorage.getItem(key)) return Promise.resolve(undefined)
      sessionStorage.setItem(key, '1')
    } catch {}
  }

  return queueSponsorEvent(
    { event, sponsor_id: sponsorId, page_path: pagePath, placement_type: placement },
    event === 'click'
  )
}

export default function SponsorDisplay({ sponsor, placement, pagePath, variant = 'banner' }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const servedFor = useRef<string | null>(null)
  const viewableFor = useRef<string | null>(null)

  useEffect(() => {
    const key = `${sponsor.id}|${pagePath}|${placement}`
    if (servedFor.current !== key) {
      servedFor.current = key
      track('served', sponsor.id, pagePath, placement)
    }

    const element = rootRef.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | null = null
    let atLeastHalfVisible = false

    const cancelTimer = () => {
      if (timer) clearTimeout(timer)
      timer = null
    }

    const beginTimerIfEligible = () => {
      if (!atLeastHalfVisible || document.visibilityState !== 'visible' || viewableFor.current === key || timer) return
      timer = setTimeout(() => {
        timer = null
        if (atLeastHalfVisible && document.visibilityState === 'visible' && viewableFor.current !== key) {
          viewableFor.current = key
          track('viewable', sponsor.id, pagePath, placement)
        }
      }, 1000)
    }

    const observer = new IntersectionObserver(entries => {
      atLeastHalfVisible = entries.some(entry => entry.target === element && entry.isIntersecting && entry.intersectionRatio >= 0.5)
      if (atLeastHalfVisible) beginTimerIfEligible()
      else cancelTimer()
    }, { threshold: [0, 0.5, 1] })

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') cancelTimer()
      else beginTimerIfEligible()
    }

    observer.observe(element)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      cancelTimer()
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [sponsor.id, pagePath, placement])

  function handleClick() {
    track('click', sponsor.id, pagePath, placement)
    if (sponsor.website_url) window.open(sponsor.website_url, '_blank', 'noopener,noreferrer')
  }

  if (variant === 'hero') {
    return (
      <div ref={rootRef} onClick={handleClick} className="rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 group"
        style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.18) 0%, rgba(8,12,24,0.97) 60%)', border: '1px solid rgba(37,99,235,0.3)', boxShadow: '0 8px 32px rgba(37,99,235,0.18)' }}>
        <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(37,99,235,0.18)' }}>
          <p className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', color: '#3b82f6', letterSpacing: '0.14em' }}>Tonight's Scores Presented By</p>
          <span className="text-xs text-blue-400 opacity-60">AD</span>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            {sponsor.logo_url ? <img src={sponsor.logo_url} alt={sponsor.business_name} className="w-14 h-14 object-contain rounded-xl flex-shrink-0 border border-white/15 shadow-lg" style={{ background: 'rgba(255,255,255,0.06)' }} /> : <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-white text-lg border border-white/15" style={{ background: 'rgba(37,99,235,0.3)', fontFamily: 'var(--font-display)' }}>{sponsor.business_name.slice(0, 2).toUpperCase()}</div>}
            <div className="min-w-0"><p className="font-black text-white leading-tight" style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '0.02em' }}>{sponsor.business_name}</p>{sponsor.tagline && <p className="text-slate-400 text-xs mt-0.5">{sponsor.tagline}</p>}</div>
          </div>
          <div className="w-full py-2.5 rounded-xl font-black text-sm text-white text-center transition-all group-hover:brightness-110" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}>VISIT {sponsor.business_name.toUpperCase()} →</div>
        </div>
      </div>
    )
  }

  if (variant === 'banner') {
    return (
      <div ref={rootRef} onClick={handleClick} className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:-translate-y-0.5 cursor-pointer group" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(8,12,20,0.85))', border: '1px solid rgba(37,99,235,0.22)' }}>
        {sponsor.logo_url ? <img src={sponsor.logo_url} alt={sponsor.business_name} className="w-10 h-10 object-contain rounded-lg flex-shrink-0 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }} /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-white text-xs" style={{ background: 'rgba(37,99,235,0.3)', fontFamily: 'var(--font-display)' }}>{sponsor.business_name.slice(0, 2).toUpperCase()}</div>}
        <div className="flex-1 min-w-0"><p className="text-xs text-slate-500" style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.1em' }}>{placement === 'scores' ? 'SCORES PRESENTED BY' : placement === 'playoff' ? 'PLAYOFFS PRESENTED BY' : placement === 'sport' ? 'COVERAGE SPONSORED BY' : 'PRESENTED BY'}</p><p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{sponsor.business_name}</p>{sponsor.tagline && <p className="text-xs text-slate-400 truncate">{sponsor.tagline}</p>}</div>
        <span className="text-xs font-black text-white px-3 py-1.5 rounded-lg flex-shrink-0 transition-all group-hover:brightness-110" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>VISIT →</span>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div ref={rootRef} onClick={handleClick} className="rounded-xl overflow-hidden transition-all hover:-translate-y-0.5 cursor-pointer group" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(8,12,24,0.95))', border: '1px solid rgba(37,99,235,0.25)' }}>
        <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: 'rgba(37,99,235,0.15)' }}><p className="text-xs font-black text-blue-400 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.12em' }}>School Sponsor</p><span className="text-xs text-blue-400 opacity-40">AD</span></div>
        <div className="px-4 py-3 flex items-center gap-3">{sponsor.logo_url ? <img src={sponsor.logo_url} alt={sponsor.business_name} className="w-10 h-10 object-contain rounded-lg flex-shrink-0 border border-white/10" style={{ background: 'rgba(255,255,255,0.05)' }} /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-black text-white text-xs" style={{ background: 'rgba(37,99,235,0.3)', fontFamily: 'var(--font-display)' }}>{sponsor.business_name.slice(0, 2).toUpperCase()}</div>}<div className="min-w-0 flex-1"><p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{sponsor.business_name}</p>{sponsor.tagline && <p className="text-xs text-slate-400 truncate">{sponsor.tagline}</p>}</div><span className="text-xs font-black text-blue-400 flex-shrink-0 group-hover:text-blue-300" style={{ fontFamily: 'var(--font-display)' }}>Visit →</span></div>
      </div>
    )
  }

  return (
    <div ref={rootRef} onClick={handleClick} className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-all hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      {sponsor.logo_url && <img src={sponsor.logo_url} alt={sponsor.business_name} className="w-5 h-5 object-contain rounded flex-shrink-0" />}
      <span className="text-xs text-slate-300 font-bold truncate">{sponsor.business_name}</span><span className="text-xs text-blue-400 ml-auto flex-shrink-0">→</span>
    </div>
  )
}
