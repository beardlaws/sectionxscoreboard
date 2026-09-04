// src/components/ShareCard.tsx
// One-click shareable score card for social media
// Generates a formatted card that can be screenshotted and shared

'use client'
import { useState } from 'react'
import { Share2, Copy, Check } from 'lucide-react'

interface Props {
  game: {
    id: string
    home_score: number | null
    away_score: number | null
    status: string
    game_date: string
    is_playoff?: boolean
    playoff_round?: string
    sport?: { sport_name: string }
    home_team?: { team_name: string; school?: { school_name: string; primary_color?: string; logo_url?: string } }
    away_team?: { team_name: string; school?: { school_name: string; primary_color?: string; logo_url?: string } }
  }
}

export default function ShareCard({ game }: Props) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const ht = game.home_team?.school?.school_name || game.home_team?.team_name || '?'
  const at = game.away_team?.school?.school_name || game.away_team?.team_name || '?'
  const htColor = game.home_team?.school?.primary_color || '#1e3a5f'
  const atColor = game.away_team?.school?.primary_color || '#334155'

  const homeWins = game.home_score != null && game.away_score != null && game.home_score > game.away_score
  const awayWins = game.home_score != null && game.away_score != null && game.away_score > game.home_score

  // Generate shareable text
  function getShareText() {
    const sport = game.sport?.sport_name || 'Game'
    const round = game.is_playoff && game.playoff_round ? `${game.playoff_round} · ` : ''
    const winner = homeWins ? ht : awayWins ? at : null
    const result = game.home_score != null
      ? `${at} ${game.away_score}, ${ht} ${game.home_score}`
      : 'TBD'
    const winText = winner ? `${winner} wins! ` : ''
    return `🏆 FINAL · ${round}${sport}\n${winText}${result}\n\nSectionXScoreboard.com`
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(getShareText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function nativeShare() {
    if (!navigator.share) { copyToClipboard(); return }
    setSharing(true)
    try {
      await navigator.share({
        title: `Section X Score`,
        text: getShareText(),
        url: `https://sectionxscoreboard.com/game-center/${game.id}`,
      })
    } catch (e) { /* user cancelled */ }
    setSharing(false)
  }

  if (game.status !== 'Final') return null

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={nativeShare}
        disabled={sharing}
        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105"
        style={{
          background: 'rgba(37,99,235,0.2)',
          color: '#60a5fa',
          border: '1px solid rgba(37,99,235,0.3)',
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.06em',
        }}
        title="Share this score"
      >
        <Share2 size={12} />
        SHARE
      </button>
      <button
        onClick={copyToClipboard}
        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105"
        style={{
          background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
          color: copied ? '#4ade80' : '#94a3b8',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.06em',
        }}
        title="Copy score text"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        {copied ? 'COPIED!' : 'COPY'}
      </button>
    </div>
  )
}
