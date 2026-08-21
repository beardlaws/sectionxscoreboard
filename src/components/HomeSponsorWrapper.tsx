// src/components/HomeSponsorWrapper.tsx
'use client'

import { useEffect, useState } from 'react'
import SponsorDisplay from './SponsorDisplay'
import { createClient } from '@/lib/supabase/client'

export default function HomeSponsorWrapper({ sponsor }: { sponsor: any }) {
  const [sponsors, setSponsors] = useState<any[]>(sponsor ? [sponsor] : [])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let mounted = true

    async function loadSponsors() {
      const supabase = createClient()
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('active', true)
        .eq('placement_type', 'homepage')
        .or(`start_date.is.null,start_date.lte.${today}`)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .order('created_at', { ascending: false })

      if (mounted && data?.length) {
        setSponsors(data)
        setIndex(0)
      }
    }

    loadSponsors()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (sponsors.length <= 1) return
    const timer = window.setInterval(() => {
      setIndex(current => (current + 1) % sponsors.length)
    }, 8000)
    return () => window.clearInterval(timer)
  }, [sponsors.length])

  if (!sponsors.length) return null

  return (
    <div>
      <SponsorDisplay sponsor={sponsors[index]} placement="homepage" pagePath="/" variant="hero" />
      {sponsors.length > 1 && (
        <div className="mt-2 flex items-center justify-between gap-3 px-1">
          <span className="text-[10px] uppercase tracking-widest text-slate-600" style={{ fontFamily: 'var(--font-display)' }}>
            Supporting Section X Scoreboard
          </span>
          <div className="flex gap-1.5" aria-label="Sponsor rotation">
            {sponsors.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show sponsor ${i + 1}`}
                className="w-2 h-2 rounded-full"
                style={{ background: i === index ? '#60a5fa' : 'rgba(148,163,184,0.25)' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
