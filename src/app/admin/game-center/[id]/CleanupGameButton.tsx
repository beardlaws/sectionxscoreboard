'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Trash2 } from 'lucide-react'

type PreviewCounts = {
  periodScores: number
  teamStats: number
  athleteStats: number
  importSources: number
  photos: number
  photoAthletes: number
  corrections: number
  shoutouts: number
}

export default function CleanupGameButton({ gameId, label }: { gameId: string; label: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [preview, setPreview] = useState<PreviewCounts | null>(null)

  async function loadPreview() {
    setChecking(true)
    try {
      const res = await fetch('/api/admin/game-center/cleanup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, action: 'preview' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not inspect game cleanup')
      setPreview(json.preview.counts)
    } catch (e: any) {
      alert(e.message || 'Could not inspect game cleanup')
    } finally {
      setChecking(false)
    }
  }

  async function cleanup() {
    if (!preview) {
      await loadPreview()
      return
    }

    const first = confirm(
      `DELETE ${label}?\n\n` +
      `${preview.periodScores} period-score rows\n` +
      `${preview.teamStats} team-stat rows\n` +
      `${preview.athleteStats} player-stat rows\n` +
      `${preview.photos} photos (${preview.photoAthletes} athlete tags)\n` +
      `${preview.importSources} import links\n` +
      `${preview.corrections} corrections\n\n` +
      `${preview.shoutouts} shoutout${preview.shoutouts === 1 ? '' : 's'} will be preserved but disconnected from the game.`
    )
    if (!first) return

    const second = confirm('FINAL WARNING: this permanently removes the game and all enrichment listed above. Continue?')
    if (!second) return

    setDeleting(true)
    try {
      const res = await fetch('/api/admin/game-center/cleanup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, action: 'delete' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Cleanup failed')
      if (!json.verifiedClean) throw new Error(`Cleanup finished but ${json.remainingReferences} references remain. Do not assume the game is fully removed.`)

      alert(
        `Verified clean. Game deleted, ${json.deleted.photos} photo${json.deleted.photos === 1 ? '' : 's'} removed, ` +
        `${json.removedStorageFiles} stored image${json.removedStorageFiles === 1 ? '' : 's'} deleted, and zero game references remain.`
      )
      router.push('/admin/game-center')
      router.refresh()
    } catch (e: any) {
      alert(e.message || 'Cleanup failed')
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck size={18} className="mt-0.5 text-red-300" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white">Verified Full Cleanup</p>
          <p className="mt-1 text-xs text-slate-400">
            Preview exactly what is attached to this game before deletion. After deletion, Section X Scoreboard checks the database again and confirms that no game references remain.
          </p>

          {preview && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Scoring', preview.periodScores],
                ['Team Stats', preview.teamStats],
                ['Player Stats', preview.athleteStats],
                ['Photos', preview.photos],
                ['Photo Tags', preview.photoAthletes],
                ['Import Links', preview.importSources],
                ['Corrections', preview.corrections],
                ['Shoutouts Kept', preview.shoutouts],
              ].map(([name, value]) => (
                <div key={String(name)} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                  <div className="text-lg font-black text-white">{value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{name}</div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {!preview && (
              <button
                type="button"
                onClick={loadPreview}
                disabled={checking || deleting}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
              >
                <ShieldCheck size={14} /> {checking ? 'Inspecting...' : 'Preview Cleanup'}
              </button>
            )}
            <button
              type="button"
              onClick={cleanup}
              disabled={checking || deleting}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 size={14} /> {deleting ? 'Deleting + Verifying...' : preview ? 'Delete Game + Everything' : 'Inspect Before Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
