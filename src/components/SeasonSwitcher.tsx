// src/components/SeasonSwitcher.tsx
// Reusable season selector for public pages
// Reads ?season= from URL, falls back to active season

'use client'
import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  seasons: { id: string; name: string; is_active: boolean; season_type?: string }[]
  currentSeasonId: string
}

const SEASON_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Spring: { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', border: 'rgba(34,197,94,0.25)' },
  Fall:   { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  Winter: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
}

export default function SeasonSwitcher({ seasons, currentSeasonId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  if (seasons.length <= 1) return null

  function switchSeason(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    const selected = seasons.find(s => s.id === id)
    const active = seasons.find(s => s.is_active)
    // If selecting the active season, remove the param (cleaner URLs)
    if (selected?.is_active) {
      params.delete('season')
    } else {
      params.set('season', id)
    }
    // Remove sport param when switching seasons
    params.delete('sport')
    router.push('?' + params.toString())
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mb-4">
      <span className="text-xs text-slate-500 flex-shrink-0" style={{ fontFamily: 'var(--font-display)' }}>
        SEASON:
      </span>
      {seasons.map(s => {
        const isSelected = s.id === currentSeasonId
        const colors = SEASON_COLORS[s.season_type || 'Spring'] || SEASON_COLORS.Spring
        return (
          <button key={s.id} onClick={() => switchSeason(s.id)}
            className="text-xs font-black px-3 py-1 rounded-full transition-all"
            style={{
              fontFamily: 'var(--font-display)',
              letterSpacing: '0.06em',
              background: isSelected ? colors.bg : 'rgba(255,255,255,0.04)',
              color: isSelected ? colors.text : '#4a5f7a',
              border: `1px solid ${isSelected ? colors.border : 'rgba(255,255,255,0.06)'}`,
            }}>
            {s.name}
            {s.is_active && <span className="ml-1 opacity-60">✓</span>}
          </button>
        )
      })}
    </div>
  )
}
