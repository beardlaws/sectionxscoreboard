'use client'

import { useEffect, useRef, useState } from 'react'
import { RealtimeKitProvider, useRealtimeKitClient } from '@cloudflare/realtimekit-react'
import { RtkParticipantsAudio } from '@cloudflare/realtimekit-react-ui'

const ParticipantsAudio = RtkParticipantsAudio as any

type Props = { broadcastId: string }

export default function LiveAudioPlayer({ broadcastId }: Props) {
  const [meeting, initMeeting] = useRealtimeKitClient()
  const [broadcast, setBroadcast] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const pendingJoin = useRef(false)

  async function refreshStatus() {
    try {
      const response = await fetch(`/api/live-audio/listen?broadcastId=${encodeURIComponent(broadcastId)}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load broadcast.')
      setBroadcast(data.live ? data.broadcast : null)
      if (!data.live && listening && meeting) {
        try { await meeting.leave() } catch {}
        setListening(false)
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load broadcast.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshStatus()
    const timer = window.setInterval(refreshStatus, 15000)
    return () => window.clearInterval(timer)
  }, [broadcastId, listening, meeting])

  useEffect(() => {
    if (!meeting || !pendingJoin.current) return
    pendingJoin.current = false
    ;(async () => {
      try {
        await meeting.join()
        setListening(true)
      } catch (e: any) {
        setError(e?.message || 'Could not join live audio.')
        try { await meeting.leave() } catch {}
      } finally {
        setJoining(false)
      }
    })()
  }, [meeting])

  useEffect(() => {
    return () => {
      if (meeting) meeting.leave().catch(() => undefined)
    }
  }, [meeting])

  async function listen() {
    if (joining || listening) return
    setJoining(true)
    setError('')
    try {
      const response = await fetch('/api/live-audio/listen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcastId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not join live audio.')
      setBroadcast(data.broadcast)
      pendingJoin.current = true
      await initMeeting({ authToken: data.credential.token, defaults: { audio: false, video: false } })
    } catch (e: any) {
      pendingJoin.current = false
      setJoining(false)
      setError(e?.message || 'Could not join live audio.')
    }
  }

  async function stopListening() {
    if (!meeting) return
    try { await meeting.leave() } catch {}
    setListening(false)
  }

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-zinc-300">Checking live audio...</div>
  }

  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-red-400">Section X Live</p>
      <h1 className="mt-2 text-2xl font-black text-white">{broadcast?.title || 'Live Audio'}</h1>

      {broadcast ? (
        <>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1.5 text-sm font-black text-red-300">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> LIVE AUDIO
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-400">Live play-by-play from Section X Scoreboard.</p>

          {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

          <div className="mt-6">
            {!listening ? (
              <button
                type="button"
                onClick={listen}
                disabled={joining}
                className="w-full rounded-xl bg-white px-5 py-4 text-lg font-black text-black disabled:opacity-50"
              >
                {joining ? 'CONNECTING...' : 'LISTEN LIVE'}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">You are listening live</div>
                  <div className="mt-1 text-sm text-zinc-300">Keep this page open for uninterrupted audio.</div>
                </div>
                <button type="button" onClick={stopListening} className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-bold text-white">
                  STOP LISTENING
                </button>
              </div>
            )}
          </div>

          {meeting ? (
            <RealtimeKitProvider value={meeting}>
              <div className="sr-only" aria-hidden="true">
                <ParticipantsAudio meeting={meeting} />
              </div>
            </RealtimeKitProvider>
          ) : null}
        </>
      ) : (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-300">
          This broadcast is not live right now.
        </div>
      )}
    </section>
  )
}
