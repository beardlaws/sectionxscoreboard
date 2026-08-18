// src/components/SponsorDisplay.tsx
// Universal sponsor display with click + impression tracking
// Drop this anywhere a sponsor should show

'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

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
  placement: string   // e.g. 'homepage', 'school', 'sport', 'scores', 'playoff'
  pagePath: string    // e.g. '/schools/canton', '/sports/football'
  variant?: 'hero' | 'banner' | 'card' | 'compact'
}

const supabase = createClient()

export default function SponsorDisplay({
  sponsor, placement, pagePath, variant = 'banner'
}: Props) {
  const tracked = useRef(false)

  // Track impression once on mount
  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    supabase.from('sponsor_impressions').insert({
      sponsor_id: sponsor.id,
      page_path: pagePath,
      placement_type: placement,
    }).then(() => {})
  }, [sponsor.id, pagePath, placement])

  async function handleClick() {
    // Track click
    await supabase.from('sponsor_clicks').insert({
      sponsor_id: sponsor.id,
      page_path: pagePath,
      placement_type: placement,
    })
    // Open website
    if (sponsor.website_url) {
      window.open(sponsor.website_url, '_blank', 'noopener,noreferrer')
    }
  }

  // ── HERO variant (homepage presenting sponsor - large) ──
  if (variant === 'hero') {
    return (
      <div
        onClick={handleClick}
        className="block rounded-2xl overflow-hidden transition-all group cursor-pointer hover:-translate-y-0.5"
        style={{
          background: 'linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(8,12,24,0.95) 60%)',
          border: '1px solid rgba(37,99,235,0.25)',
          boxShadow: '0 8px 32px rgba(37,99,235,0.15)',
        }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(37,99,235,0.15)' }}>
          <p className="text-xs font-black uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-display)', color: '#3b82f6', letterSpacing: '0.14em' }}>
            Tonight's Scores Presented By
          </p>
        </div>
        <div className="px-4 py-4 flex items-center gap-4">
          {sponsor.logo_url && (
            <img src={sponsor.logo_url} alt={sponsor.business_name}
              className="w-16 h-16 object-contain rounded-xl flex-shrink-0 border border-white/10"
              style={{ background: 'rgba(255,255,255,0.05)' }} />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-black text-white leading-tight mb-1"
              style={{ fontFamily: 'var(--font-display)', fontSize: '22px' }}>
              {sponsor.business_name}
            </p>
            {sponsor.tagline && (
              <p className="text-slate-400 text-sm">{sponsor.tagline}</p>
            )}
          </div>
          <div className="flex-shrink-0">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm text-white"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                fontFamily: 'var(--font-display)',
                letterSpacing: '0.06em',
                boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
              }}>
              VISIT →
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── BANNER variant (scores page, playoffs - full width slim) ──
  if (variant === 'banner') {
    return (
      <div
        onClick={handleClick}
        className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:-translate-y-0.5 cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(8,12,20,0.8))',
          border: '1px solid rgba(37,99,235,0.2)',
        }}>
        {sponsor.logo_url && (
          <img src={sponsor.logo_url} alt={sponsor.business_name}
            className="w-10 h-10 object-contain rounded-lg flex-shrink-0 border border-white/10"
            style={{ background: 'rgba(255,255,255,0.05)' }} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500"
            style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.1em' }}>
            {placement === 'scores' ? 'SCORES PRESENTED BY'
              : placement === 'playoff' ? 'PLAYOFFS PRESENTED BY'
              : placement === 'sport' ? 'COVERAGE BY'
              : 'PRESENTED BY'}
          </p>
          <p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>
            {sponsor.business_name}
          </p>
          {sponsor.tagline && (
            <p className="text-xs text-slate-400 truncate">{sponsor.tagline}</p>
          )}
        </div>
        <span className="text-xs font-black text-blue-400 flex-shrink-0 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(37,99,235,0.15)', fontFamily: 'var(--font-display)', border: '1px solid rgba(37,99,235,0.25)' }}>
          VISIT →
        </span>
      </div>
    )
  }

  // ── CARD variant (school pages - sidebar) ──
  if (variant === 'card') {
    return (
      <div
        onClick={handleClick}
        className="rounded-xl overflow-hidden transition-all hover:-translate-y-0.5 cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(8,12,24,0.95))',
          border: '1px solid rgba(37,99,235,0.25)',
        }}>
        <div className="px-4 py-2 border-b" style={{ borderColor: 'rgba(37,99,235,0.15)' }}>
          <p className="text-xs font-black text-blue-400 uppercase tracking-widest"
            style={{ fontFamily: 'var(--font-display)', fontSize: '10px', letterSpacing: '0.12em' }}>
            School Sponsor
          </p>
        </div>
        <div className="px-4 py-3 flex items-center gap-3">
          {sponsor.logo_url && (
            <img src={sponsor.logo_url} alt={sponsor.business_name}
              className="w-10 h-10 object-contain rounded-lg flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)' }} />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-black text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>
              {sponsor.business_name}
            </p>
            {sponsor.tagline && (
              <p className="text-xs text-slate-400 truncate">{sponsor.tagline}</p>
            )}
          </div>
          <span className="text-xs text-blue-400 ml-auto flex-shrink-0 font-bold"
            style={{ fontFamily: 'var(--font-display)' }}>
            Visit →
          </span>
        </div>
      </div>
    )
  }

  // ── COMPACT variant (small inline placements) ──
  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-all hover:bg-white/5"
      style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      {sponsor.logo_url && (
        <img src={sponsor.logo_url} alt={sponsor.business_name}
          className="w-6 h-6 object-contain rounded flex-shrink-0" />
      )}
      <span className="text-xs text-slate-300 font-bold truncate">{sponsor.business_name}</span>
      <span className="text-xs text-blue-400 ml-auto flex-shrink-0">→</span>
    </div>
  )
}
