import { NextRequest, NextResponse } from 'next/server'
import { getBroadcastRepository, getLiveAudioService } from '@/lib/live-audio/runtime'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const broadcastId = String(req.nextUrl.searchParams.get('broadcastId') || '')
    const gameId = String(req.nextUrl.searchParams.get('gameId') || '')
    if (!broadcastId && !gameId) return NextResponse.json({ error: 'Broadcast or game is required.' }, { status: 400 })

    const repository = getBroadcastRepository()
    const broadcast = broadcastId
      ? await repository.getById(broadcastId)
      : await repository.getLiveByGame(gameId)

    if (!broadcast || !broadcast.publicEnabled || broadcast.status !== 'live') {
      return NextResponse.json({ live: false, broadcast: null })
    }
    return NextResponse.json({ live: true, broadcast })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load broadcast.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const broadcastId = String(body?.broadcastId || '')
    if (!broadcastId) return NextResponse.json({ error: 'Broadcast is required.' }, { status: 400 })

    const result = await getLiveAudioService().createListenerCredential({
      broadcastId,
      userAgent: req.headers.get('user-agent'),
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    const message = error?.message || 'Could not join broadcast.'
    const status = /not live|not found/i.test(message) ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
