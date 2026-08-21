'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SponsorDisplay from './SponsorDisplay'

export default function GlobalSponsorStrip() {
  const pathname = usePathname()
  const [sponsors, setSponsors] = useState<any[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let mounted = true

    async function loadSponsors() {
      const supabase = createClient()
      const { data } = await supabase
        .from('sponsors')
        .select('id,business_name,website_url,tagline,logo_url,placement_type,start_date,end_date,active')
        .eq('active', true)
        .order('created_at', { ascending: false })

      if (!mounted) return

      const today = new Date().toISOString().slice(0, 10)
      const eligible = (data || []).filter((s: any) => {
        if (s.start_date && s.start_date > today) return false
        if (s.end_date && s.end_date < today) return false
        return true
      })

      setSponsors(eligible)
      setIndex(0)
    }

    loadSponsors()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (sponsors.length <= 1) return
    const timer = window.setInterval(() => {
      setIndex(current => (current + 1) % sponsors.length)
    }, 7000)
    return () => window.clearInterval(timer)
  }, [sponsors.length])

  const sponsor = useMemo(() => sponsors[index] || null, [sponsors, index])
  if (!sponsor) return null

  return (
    <div className="border-b border-white/[0.06]" style={{ background: 'rgba(7,11,19,0.96)' }}>
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="hidden sm:block flex-shrink-0">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600" style={{ fontFamily: 'var(--font-display)' }}>
              Section X Partner
            </p>
          </div>
          <div className="flex-1 min-w-0">
            <SponsorDisplay sponsor={sponsor} placement="network" pagePath={pathname || '/'} variant="compact" />
          </div>
          {sponsors.length > 1 && (
            <div className="flex items-center gap-1.5 flex-shrink-0" aria-label="Sponsor rotation">
              {sponsors.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${item.business_name}`}
                  className="w-2 h-2 rounded-full"
                  style={{ background: i === index ? '#60a5fa' : 'rgba(148,163,184,0.22)' }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
