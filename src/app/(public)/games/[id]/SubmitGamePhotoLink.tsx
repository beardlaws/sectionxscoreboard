'use client'

import Link from 'next/link'

export default function SubmitGamePhotoLink({ gameId }: { gameId: string }) {
  return (
    <Link
      href={`/submit-photo?game=${gameId}`}
      className="block rounded-xl p-4 mb-4 transition-colors hover:border-blue-500/50"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <div className="text-sm font-bold text-white">Have photos from this game?</div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
        Submit them for the Section X archive. Approved photos stay connected to this matchup and photographer credit is always shown.
      </div>
      <div className="text-xs font-bold mt-3" style={{ color: 'var(--accent)' }}>SUBMIT GAME PHOTOS →</div>
    </Link>
  )
}
