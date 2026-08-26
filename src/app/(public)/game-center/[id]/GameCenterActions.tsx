'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import CorrectionForm from '../../games/[id]/CorrectionForm'

export default function GameCenterActions({ gameId, shareTitle }: { gameId: string; shareTitle: string }) {
  const [copied, setCopied] = useState(false)

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
    <div className="flex flex-wrap items-center gap-3">
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
