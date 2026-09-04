// src/app/admin/submissions/SubmissionQueue.tsx
'use client'

import { useState } from 'react'
import { adminDb } from '@/lib/adminDb'
import { format } from 'date-fns'
import type { Sport } from '@/types'

type CanonicalMatch = {
  id: string
  home_name: string
  away_name: string
  home_score: number | null
  away_score: number | null
  status: string | null
  game_time?: string | null
  contest_type?: string | null
  source?: string | null
  orientation: 'direct' | 'reversed'
  submitted_home_score: number | null
  submitted_away_score: number | null
  already_matches: boolean
  conflicts: boolean
}

type QueueSubmission = {
  id: string
  submitter_name?: string | null
  submitter_email?: string | null
  sport_name?: string | null
  home_team_name?: string | null
  away_team_name?: string | null
  home_score?: number | null
  away_score?: number | null
  game_date: string
  notes?: string | null
  created_at: string
  canonical_match_state?: 'matched' | 'unmatched' | 'ambiguous'
  canonical_candidate_count?: number
  canonical_match?: CanonicalMatch | null
}

interface Props {
  submissions: QueueSubmission[]
  sports: Sport[]
}

function ScoreBox({ value }: { value: number | null | undefined }) {
  return <span className="inline-flex min-w-8 justify-center rounded border border-white/10 bg-black/20 px-2 py-1 font-black text-white">
    {value == null ? '—' : value}
  </span>
}

export default function SubmissionQueue({ submissions }: Props) {
  const [items, setItems] = useState(submissions)
  const [loading, setLoading] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const closeSubmission = async (sub: QueueSubmission, status: 'approved' | 'rejected') => {
    await adminDb.update('submissions', { status }, { id: sub.id })
    setItems(prev => prev.filter(s => s.id !== sub.id))
  }

  const handleApprove = async (sub: QueueSubmission) => {
    setLoading(sub.id)
    setMessage('')
    try {
      const match = sub.canonical_match
      if (!match) {
        throw new Error('No unique canonical game match. Nothing was changed.')
      }
      if (match.conflicts) {
        throw new Error('This submission conflicts with an existing final. Use Manage Games if the official score needs correction.')
      }

      if (!match.already_matches) {
        await adminDb.update('games', {
          home_score: match.submitted_home_score,
          away_score: match.submitted_away_score,
          status: 'Final',
          verification_status: 'Reported',
        }, { id: match.id })
        setMessage(`Updated existing game: ${match.away_name} at ${match.home_name}. No new game was created.`)
      } else {
        setMessage(`Submission already matched the official final for ${match.away_name} at ${match.home_name}; closed with no score change.`)
      }

      await closeSubmission(sub, 'approved')
    } catch (e: any) {
      setMessage(e?.message || 'Could not review submission.')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async (sub: QueueSubmission) => {
    setLoading(sub.id)
    setMessage('')
    try {
      await closeSubmission(sub, 'rejected')
      setMessage('Submission dismissed. No game data changed.')
    } catch (e: any) {
      setMessage(e?.message || 'Could not dismiss submission.')
    } finally {
      setLoading(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        {message && <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">{message}</div>}
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">✓</div>
          <p className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>Queue is empty</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>All submissions have been reviewed.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {message && <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">{message}</div>}

      {items.map(sub => {
        const expanded = expandedId === sub.id
        const isLoading = loading === sub.id
        const match = sub.canonical_match
        const safeToApprove = Boolean(match && !match.conflicts)
        const badge = !match
          ? sub.canonical_match_state === 'ambiguous'
            ? ['AMBIGUOUS MATCH', 'text-amber-300 bg-amber-500/10 border-amber-500/20']
            : ['NO GAME MATCH', 'text-red-300 bg-red-500/10 border-red-500/20']
          : match.conflicts
            ? ['SCORE CONFLICT', 'text-red-300 bg-red-500/10 border-red-500/20']
            : match.already_matches
              ? ['ALREADY MATCHES', 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20']
              : ['CANONICAL MATCH', 'text-blue-300 bg-blue-500/10 border-blue-500/20']

        return (
          <div key={sub.id} className="card overflow-hidden">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setExpandedId(expanded ? null : sub.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${badge[1]}`}>{badge[0]}</span>
                    <span className="text-xs text-slate-500">{sub.sport_name} · {sub.game_date}</span>
                  </div>

                  <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">Fan submitted</div>
                  <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                    <span className="text-slate-300">{sub.away_team_name || 'Away team'}</span><ScoreBox value={sub.away_score} />
                    <span className="text-slate-300">{sub.home_team_name || 'Home team'}</span><ScoreBox value={sub.home_score} />
                  </div>

                  {match && <>
                    <div className="mt-4 text-xs uppercase tracking-wide text-slate-500">Matched Section X game</div>
                    <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
                      <span className="font-semibold text-white">{match.away_name}</span><ScoreBox value={match.away_score} />
                      <span className="font-semibold text-white">{match.home_name}</span><ScoreBox value={match.home_score} />
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {match.status || 'Scheduled'}{match.contest_type ? ` · ${match.contest_type}` : ''}{match.source ? ` · source: ${match.source}` : ''}
                    </div>
                  </>}

                  {!match && <div className="mt-3 text-xs text-amber-200/80">
                    This report cannot safely write a score until it resolves to one existing scheduled game.
                  </div>}

                  {match?.already_matches && <div className="mt-3 text-xs text-emerald-300">
                    Official final already matches this report. Approving will only close the submission.
                  </div>}

                  {match?.conflicts && <div className="mt-3 text-xs text-red-300">
                    Existing final differs from this fan report. Automatic overwrite is blocked.
                  </div>}

                  <div className="mt-3 text-xs text-slate-600">
                    {sub.submitter_name ? `By ${sub.submitter_name} · ` : ''}{format(new Date(sub.created_at), 'M/d h:mm a')}
                  </div>
                </button>

                <div className="flex gap-2 sm:flex-col" onClick={e => e.stopPropagation()}>
                  <button
                    className="btn-success text-xs py-2 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => handleApprove(sub)}
                    disabled={isLoading || !safeToApprove}
                    title={!safeToApprove ? 'Resolve the canonical game or conflict first' : undefined}
                  >
                    {match?.already_matches ? '✓ Close Match' : '✓ Apply to Game'}
                  </button>
                  <button className="btn-danger text-xs py-2 px-3" onClick={() => handleReject(sub)} disabled={isLoading}>
                    ✗ Dismiss
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 pt-4 space-y-2 text-sm" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="section-label">Submission details</div>
                  {sub.notes && <div className="rounded bg-black/20 p-2 text-slate-300">Notes: {sub.notes}</div>}
                  {sub.submitter_email && <div className="text-xs text-slate-500">Contact: {sub.submitter_email}</div>}
                  {match?.orientation === 'reversed' && <div className="text-xs text-amber-300">
                    Submitted home/away orientation was reversed relative to the canonical game. Scores will be mapped to the correct teams.
                  </div>}
                  <div className="text-xs text-slate-600">Fan submissions never create a game and never automatically overwrite an existing final.</div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
