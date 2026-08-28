'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
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

  return <div className="border-b border-white/[0.06] bg-yellow-300/[0.025]">
    <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[9px] font-black uppercase tracking-[.16em] text-yellow-300/70">Your Section X</div>
        <div className="truncate text-xs text-white/50">Follow {team.name} for the updates you care about.</div>
      </div>
      <FollowButton targetType="team" targetId={team.id} targetName={team.name} compact />
    </div>
  </div>
}
