'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRealtimeKitClient } from '@cloudflare/realtimekit-react'

type AssignmentRow = {
  broadcast: {
    id: string
    gameId: string
    title: string
    status: 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled'
    rightsStatus: 'pending' | 'approved' | 'not_required' | 'denied' | 'expired'
    scheduledAt: string | null
    startedAt: string | null
  }
  assignment: { role: string; displayName: string | null }
}

export default function BroadcastConsole() {
  const [meeting, initMeeting] = useRealtimeKitClient()
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [selectedBroadcastId, setSelectedBroadcastId] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [meter, setMeter] = useState(0)
  const [micReady, setMicReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [live, setLive] = useState(false)
  const [muted, setMuted] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [, setClockTick] = useState(0)
  const [online, setOnline] = useState(true)
  const [error, setError] = useState('')
  const pendingStart = useRef<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationRef = useRef<number | null>(null)

  const selected = useMemo(
    () => assignments.find((row) => row.broadcast.id === selectedBroadcastId) || null,
    [assignments, selectedBroadcastId],
  )

  useEffect(() => {
    setOnline(navigator.onLine)
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    fetch('/api/live-audio/broadcaster', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load broadcasts.')
        const rows = (data.assignments || []) as AssignmentRow[]
        setAssignments(rows)
        setSelectedBroadcastId(rows[0]?.broadcast.id || '')
      })
      .catch((e) => setError(e.message || 'Could not load broadcasts.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!meeting || !pendingStart.current) return
    const broadcastId = pendingStart.current
    pendingStart.current = null

    ;(async () => {
      try {
        const available = await meeting.self.getAudioDevices()
        const preferred = available.find((device: any) => device.deviceId === selectedDeviceId)
        if (preferred) await meeting.self.setDevice(preferred)
        await meeting.join()
        if (!meeting.self.audioEnabled) await meeting.self.enableAudio()
        const response = await fetch('/api/live-audio/broadcaster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ broadcastId, action: 'go-live' }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not start broadcast.')
        setLive(true)
        setMuted(false)
        setStartedAt(Date.now())
      } catch (e: any) {
        setError(e?.message || 'Could not start broadcast.')
        try { await meeting.leave() } catch {}
      } finally {
        setWorking(false)
      }
    })()
  }, [meeting, selectedDeviceId])

  useEffect(() => {
    if (!live || !startedAt) return
    const timer = window.setInterval(() => setClockTick((tick) => tick + 1), 1000)
    return () => window.clearInterval(timer)
  }, [live, startedAt])

  useEffect(() => {
    return () => stopMicTest()
  }, [])

  function stopMicTest() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    animationRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    audioContextRef.current?.close().catch(() => undefined)
    audioContextRef.current = null
    setMeter(0)
  }

  async function testMicrophone(deviceId?: string) {
    setError('')
    stopMicTest()
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const microphones = allDevices.filter((device) => device.kind === 'audioinput')
      setDevices(microphones)
      const activeId = stream.getAudioTracks()[0]?.getSettings().deviceId || microphones[0]?.deviceId || ''
      setSelectedDeviceId(deviceId || activeId)

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
      const context = new AudioContextCtor()
      audioContextRef.current = context
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const samples = new Uint8Array(analyser.frequencyBinCount)
      const draw = () => {
        analyser.getByteFrequencyData(samples)
        const average = samples.reduce((sum, value) => sum + value, 0) / Math.max(1, samples.length)
        setMeter(Math.min(100, Math.round((average / 128) * 100)))
        animationRef.current = requestAnimationFrame(draw)
      }
      draw()
      setMicReady(true)
    } catch (e: any) {
      setMicReady(false)
      setError(e?.message || 'Microphone permission is required.')
    }
  }

  async function changeMicrophone(deviceId: string) {
    setSelectedDeviceId(deviceId)
    await testMicrophone(deviceId)
  }

  async function goLive() {
    if (!selected || !micReady || working) return
    setWorking(true)
    setError('')
    try {
      const response = await fetch('/api/live-audio/broadcaster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcastId: selected.broadcast.id, action: 'credential' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not prepare broadcast.')
      stopMicTest()
      pendingStart.current = selected.broadcast.id
      await initMeeting({ authToken: data.credential.token, defaults: { audio: true, video: false } })
    } catch (e: any) {
      pendingStart.current = null
      setWorking(false)
      setError(e?.message || 'Could not prepare broadcast.')
    }
  }

  async function toggleMute() {
    if (!meeting || !live) return
    try {
      if (muted) await meeting.self.enableAudio()
      else await meeting.self.disableAudio()
      setMuted(!muted)
    } catch (e: any) {
      setError(e?.message || 'Could not change microphone state.')
    }
  }

  async function endBroadcast() {
    if (!selected || !meeting || !live || working) return
    if (!window.confirm('End this Section X Live broadcast?')) return
    setWorking(true)
    setError('')
    try {
      const response = await fetch('/api/live-audio/broadcaster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcastId: selected.broadcast.id, action: 'end' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not end broadcast.')
      try { await meeting.leave() } catch {}
      setLive(false)
      setMuted(false)
      setStartedAt(null)
      setAssignments((rows) => rows.filter((row) => row.broadcast.id !== selected.broadcast.id))
      setSelectedBroadcastId('')
    } catch (e: any) {
      setError(e?.message || 'Could not end broadcast.')
    } finally {
      setWorking(false)
    }
  }

  const elapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')
  const seconds = String(elapsed % 60).padStart(2, '0')

  if (loading) return <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6 text-zinc-300">Loading your broadcasts...</div>

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <section className="rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Section X Live</p>
            <h1 className="mt-1 text-2xl font-black text-white">Broadcast Console</h1>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-bold ${online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
            {online ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

        {!assignments.length ? (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-zinc-300">
            No broadcasts are assigned to this contributor account yet.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <label className="block text-sm font-semibold text-zinc-300">
              Assigned game
              <select
                value={selectedBroadcastId}
                onChange={(event) => setSelectedBroadcastId(event.target.value)}
                disabled={live}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-base text-white outline-none"
              >
                {assignments.map((row) => (
                  <option key={row.broadcast.id} value={row.broadcast.id}>{row.broadcast.title}</option>
                ))}
              </select>
            </label>

            {selected ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-zinc-300">{selected.assignment.role}</span>
                  <span className={`rounded-full px-2.5 py-1 ${['approved','not_required'].includes(selected.broadcast.rightsStatus) ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
                    Rights: {selected.broadcast.rightsStatus.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-3 text-xl font-black text-white">{selected.broadcast.title}</div>
              </div>
            ) : null}

            {!live ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-zinc-300">Microphone</span>
                    <span className={micReady ? 'text-emerald-300' : 'text-zinc-500'}>{micReady ? 'SIGNAL READY' : 'NOT TESTED'}</span>
                  </div>
                  {devices.length ? (
                    <select
                      value={selectedDeviceId}
                      onChange={(event) => changeMicrophone(event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
                    >
                      {devices.map((device, index) => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>
                      ))}
                    </select>
                  ) : null}
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-emerald-400 transition-[width] duration-75" style={{ width: `${meter}%` }} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => testMicrophone(selectedDeviceId || undefined)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-bold text-white hover:bg-white/10"
                >
                  {micReady ? 'RETEST MICROPHONE' : 'TEST MICROPHONE'}
                </button>

                <button
                  type="button"
                  onClick={goLive}
                  disabled={!selected || !micReady || !online || working || !['approved','not_required'].includes(selected?.broadcast.rightsStatus || 'pending')}
                  className="w-full rounded-xl bg-red-600 px-5 py-4 text-lg font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {working ? 'STARTING...' : 'GO LIVE'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center">
                  <div className="text-sm font-black uppercase tracking-[0.25em] text-red-300">LIVE AUDIO</div>
                  <div className="mt-2 font-mono text-3xl font-black text-white">{hours}:{minutes}:{seconds}</div>
                  <div className="mt-2 text-sm text-zinc-300">Keep this page open while broadcasting.</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={toggleMute} className="rounded-xl border border-white/15 bg-white/5 px-4 py-4 font-black text-white">
                    {muted ? 'UNMUTE' : 'MUTE'}
                  </button>
                  <button type="button" onClick={endBroadcast} disabled={working} className="rounded-xl bg-red-700 px-4 py-4 font-black text-white disabled:opacity-50">
                    END BROADCAST
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
