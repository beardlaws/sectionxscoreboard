'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export default function CleanupGameButton({ gameId, label }: { gameId: string; label: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function cleanup() {
    const first = confirm(`Delete ${label}? This will permanently remove the game, its period scoring, team stats, player stats, import links, and every photo tied to this game.`)
    if (!first) return
    const second = confirm('This cannot be undone. Continue with full cleanup?')
    if (!second) return

    setDeleting(true)
    try {
      const res = await fetch('/api/admin/game-center/cleanup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Cleanup failed')
      alert(`Game deleted. ${json.removedPhotos || 0} linked photo${json.removedPhotos === 1 ? '' : 's'} removed from storage.`)
      router.push('/admin/game-center')
      router.refresh()
    } catch (e: any) {
      alert(e.message || 'Cleanup failed')
      setDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={cleanup}
      disabled={deleting}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
    >
      <Trash2 size={14} /> {deleting ? 'Deleting Everything...' : 'Delete Game + All Enrichment'}
    </button>
  )
}
