'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CalendarPlus, Images } from 'lucide-react'
import FollowButton from '@/components/FollowButton'

export default function ContextualFanBar() {
  const pathname = usePathname()
  const [team, setTeam] = useState<any>(null)

  useEffect(() => {
    setTeam(null)
    const match = pathname.match(/^\/teams\/([^/?#]+)/)
    if (!match) return
    let cancelled = false
    fetch(`/api/fan-context?teamSlug=${encodeURIComponent(match[1])}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(body => { if (!cancelled) setTeam(body?.team || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [pathname])

  if (!team) return null
  const slugMatch=pathname.match(/^\/teams\/([^/?#]+)/)
  const teamSlug=slugMatch?.[1]||''

  return <div className="border-b border-white/[0.06] bg-yellow-300/[0.025]">
    <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-[.16em] text-yellow-300/70">Your Section X</div>
        <div className="truncate text-xs text-white/50">Follow {team.name}, browse the season photos, or add its live-updating schedule.</div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {teamSlug&&<a href={`/teams/${teamSlug}/photos`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white/65 hover:border-blue-400/30 hover:text-blue-300"><Images size={14}/> Photos</a>}
        <a href={`/api/calendar/team/${team.id}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white/65 hover:border-yellow-300/20 hover:text-yellow-200"><CalendarPlus size={14}/> Add calendar</a>
        <FollowButton targetType="team" targetId={team.id} targetName={team.name} compact buttonLabel={`Follow ${team.name}`} />
      </div>
    </div>
  </div>
}
