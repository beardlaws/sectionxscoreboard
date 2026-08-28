'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Check, Radio } from 'lucide-react'
import CorrectionForm from '../../games/[id]/CorrectionForm'
import FollowButton from '@/components/FollowButton'

type FanContext = {
  game?: { id: string; status: string; live: boolean }
  homeTeam?: { id: string; name: string } | null
  awayTeam?: { id: string; name: string } | null
}

const shortFollowName = (name: string) => name.replace(' Central High School','').replace(' Central School','').replace(' High School','').replace(' School','')

export default function GameCenterActions({ gameId, shareTitle }: { gameId: string; shareTitle: string }) {
  const [copied, setCopied] = useState(false)
  const [context, setContext] = useState<FanContext | null>(null)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    async function tick(first = false) {
      try {
        const response = await fetch(`/api/fan-context?gameId=${encodeURIComponent(gameId)}`, { cache: 'no-store' })
        if (!response.ok) return
        const next = await response.json() as FanContext
        if (cancelled) return
        setContext(next)
        if (!first && next.game?.live && document.visibilityState === 'visible') router.refresh()
        timer = window.setTimeout(() => tick(false), next.game?.live ? 20000 : 60000)
      } catch {
        if (!cancelled) timer = window.setTimeout(() => tick(false), 60000)
      }
    }
    tick(true)
    return () => { cancelled = true; if (timer) window.clearTimeout(timer) }
  }, [gameId, router])

  async function shareGame() {
    const url = window.location.href
    try {
      if (navigator.share) { await navigator.share({ title: shareTitle, url }); return }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  return <div className="flex flex-wrap items-center justify-center gap-3">
    {context?.game?.live && <div className="inline-flex items-center gap-2 rounded-xl border border-yellow-300/20 bg-yellow-300/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-yellow-200"><Radio size={13} className="animate-pulse" /> Live updates on · 20s refresh</div>}
    {context?.awayTeam && <FollowButton targetType="team" targetId={context.awayTeam.id} targetName={context.awayTeam.name} compact buttonLabel={`Follow ${shortFollowName(context.awayTeam.name)}`} />}
    {context?.homeTeam && <FollowButton targetType="team" targetId={context.homeTeam.id} targetName={context.homeTeam.name} compact buttonLabel={`Follow ${shortFollowName(context.homeTeam.name)}`} />}
    <button type="button" onClick={shareGame} className="inline-flex items-center gap-2 rounded-xl bg-yellow-300 px-4 py-2.5 text-xs font-black text-black hover:bg-yellow-200 transition-colors">{copied ? <Check size={15} /> : <Share2 size={15} />}{copied ? 'Link copied' : 'Share game'}</button>
    <CorrectionForm gameId={gameId} />
  </div>
}
