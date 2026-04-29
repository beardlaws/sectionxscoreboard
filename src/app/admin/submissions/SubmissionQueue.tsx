// src/app/admin/submissions/SubmissionQueue.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { adminDb } from '@/lib/adminDb'
import { format } from 'date-fns'
import type { Submission, Sport, Season } from '@/types'

interface Team {
  id: string
  team_name: string
  sport_id: string
  school: { school_name: string } | null
}

interface Props {
  submissions: Submission[]
  sports: Sport[]
  teams: Team[]
  seasons: Season[]
}

export default function SubmissionQueue({ submissions, sports, teams, seasons }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(submissions)
  const [loading, setLoading] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editMap, setEditMap] = useState<Record<string, any>>({})

  const getEdit = (id: string, field: string, fallback: any) =>
    editMap[id]?.[field] ?? fallback

  const setEdit = (id: string, field: string, value: any) => {
    setEditMap(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }))
  }

  const handleAction = async (sub: Submission, action: 'approve' | 'reject') => {
    setLoading(sub.id)
    const supabase = createClient()

    if (action === 'approve') {
      const edit = editMap[sub.id] || {}
      // Create the game
      const activeSeason = seasons.find(s => s.is_active) || seasons[0]
      const sport = sports.find(s => s.sport_name === (edit.sport_name || sub.sport_name))

      await adminDb.insert('games', {
        season_id: activeSeason?.id || null,
        sport_id: sport?.id || null,
        game_date: edit.game_date || sub.game_date,
        home_score: edit.home_score ?? sub.home_score,
        away_score: edit.away_score ?? sub.away_score,
        status: 'Final',
        verification_status: 'Reported',
        source: 'public_submission',
        notes: sub.notes,
      })
    }

    await adminDb.update('submissions', { status: action === 'approve' ? 'approved' : 'rejected' }, { id: sub.id })

    setItems(prev => prev.filter(s => s.id !== sub.id))
    setLoading(null)
  }

  if (items.length === 0) {
    return (
      <div className="card p-10 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
          Queue is empty
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>All submissions have been reviewed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(sub => {
        const expanded = expandedId === sub.id
        const isLoading = loading === sub.id

        return (
          <div key={sub.id} className="card overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => setExpandedId(expanded ? null : sub.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                  {sub.away_team_name} {sub.away_score} @ {sub.home_team_name} {sub.home_score}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {sub.sport_name} · {sub.game_date}
                  {sub.submitter_name && ` · By ${sub.submitter_name}`}
                  {' · '}{format(new Date(sub.created_at), 'M/d h:mm a')}
                </div>
              </div>
              <div className="flex gap-2 ml-3" onClick={e => e.stopPropagation()}>
                <button
                  className="btn-success text-xs py-1 px-3"
                  onClick={() => handleAction(sub, 'approve')}
                  disabled={isLoading}
                >
                  ✓ Approve
                </button>
                <button
                  className="btn-danger text-xs py-1 px-3"
                  onClick={() => handleAction(sub, 'reject')}
                  disabled={isLoading}
                >
                  ✗ Reject
                </button>
              </div>
            </div>

            {/* Expanded edit view */}
            {expanded && (
              <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="pt-3 text-xs section-label">Edit before approving (optional)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="label">Date</label>
                    <input className="input text-sm"
                      type="date"
                      value={getEdit(sub.id, 'game_date', sub.game_date)}
                      onChange={e => setEdit(sub.id, 'game_date', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Sport</label>
                    <select className="input text-sm"
                      value={getEdit(sub.id, 'sport_name', sub.sport_name)}
                      onChange={e => setEdit(sub.id, 'sport_name', e.target.value)}
                    >
                      {sports.map(s => <option key={s.id} value={s.sport_name}>{s.sport_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Away Score</label>
                    <input className="input text-sm"
                      type="number"
                      value={getEdit(sub.id, 'away_score', sub.away_score)}
                      onChange={e => setEdit(sub.id, 'away_score', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">Home Score</label>
                    <input className="input text-sm"
                      type="number"
                      value={getEdit(sub.id, 'home_score', sub.home_score)}
                      onChange={e => setEdit(sub.id, 'home_score', parseInt(e.target.value))}
                    />
                  </div>
                </div>
                {sub.notes && (
                  <div className="text-sm p-2 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                    Notes: {sub.notes}
                  </div>
                )}
                {sub.submitter_email && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Contact: {sub.submitter_email}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
