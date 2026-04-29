// src/app/(public)/games/[id]/CorrectionForm.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CorrectionForm({ gameId }: { gameId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim()) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('correction_requests').insert({
      game_id: gameId,
      submitter_name: name,
      submitter_email: email,
      correction_text: text,
      status: 'pending',
    })
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="card p-4 text-center">
        <span className="text-2xl">✅</span>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
          Thanks! Your correction has been submitted and will be reviewed.
        </p>
      </div>
    )
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs flex items-center gap-1 hover:text-white transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          ⚠️ Report a Correction
        </button>
      ) : (
        <div className="card p-4">
          <h3 className="font-semibold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-secondary)' }}>
            Report a Correction
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Your Name</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div>
              <label className="label">What's incorrect?</label>
              <textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder="Describe the correction..." rows={3} />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={handleSubmit} disabled={loading || !text.trim()}>
                {loading ? 'Submitting...' : 'Submit Correction'}
              </button>
              <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
