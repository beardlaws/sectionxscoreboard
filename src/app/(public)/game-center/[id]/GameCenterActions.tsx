'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Share2, Check, Radio } from 'lucide-react'
import CorrectionForm from '../../games/[id]/CorrectionForm'

export default function GameCenterActions({ gameId, shareTitle }: { gameId: string; shareTitle: string }) {
  const [copied, setCopied] = useState(false)
  const [liveRefreshing, setLiveRefreshing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    function pageLooksLive() {
      if (typeof document === 'undefined') return false
      const text = document.body.innerText || ''
      return text.includes('Latest reported score') || text.includes('LIVE')
    }

    const isLive = pageLooksLive()
    setLiveRefreshing(isLive)
    if (!isLive) return

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, 20000)

    return () => window.clearInterval(timer)
  }, [router])

  async function shareGame() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // User cancellation should not surface as an error.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {liveRefreshing && (
        <div className="inline-flex items-center gap-2 rounded-xl border border-yellow-300/20 bg-yellow-300/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-yellow-200">
          <Radio size={13} className="animate-pulse" /> Live updates on
        </div>
      )}
      <button
        type="button"
        onClick={shareGame}
        className="inline-flex items-center gap-2 rounded-xl bg-yellow-300 px-4 py-2.5 text-xs font-black text-black hover:bg-yellow-200 transition-colors"
      >
        {copied ? <Check size={15} /> : <Share2 size={15} />}
        {copied ? 'Link copied' : 'Share game'}
      </button>
      <CorrectionForm gameId={gameId} />
    </div>
  )
}
