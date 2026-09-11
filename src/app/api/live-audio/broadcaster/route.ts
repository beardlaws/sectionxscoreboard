import { NextRequest, NextResponse } from 'next/server'
import { getContributorUser } from '@/lib/contributorAuth'
import { getBroadcastRepository, getLiveAudioService } from '@/lib/live-audio/runtime'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const user = await getContributorUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

    const repository = getBroadcastRepository()
    const assignments = await repository.listForSubject(user.id)
    return NextResponse.json({ ok: true, assignments })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load broadcasts.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getContributorUser(req)
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })

    const body = await req.json()
    const broadcastId = String(body?.broadcastId || '')
    const action = String(body?.action || '')
    if (!broadcastId) return NextResponse.json({ error: 'Broadcast is required.' }, { status: 400 })

    const service = getLiveAudioService()
    if (action === 'credential') {
      const result = await service.createPublisherCredential({
        broadcastId,
        subjectId: user.id,
        displayName: String(user.user_metadata?.display_name || user.email || 'Section X Broadcaster'),
        userAgent: req.headers.get('user-agent'),
      })
      return NextResponse.json({ ok: true, ...result })
    }
    if (action === 'go-live') {
      const broadcast = await service.goLive({ broadcastId, subjectId: user.id })
      return NextResponse.json({ ok: true, broadcast })
    }
    if (action === 'end') {
      const broadcast = await service.endBroadcast({ broadcastId, subjectId: user.id })
      return NextResponse.json({ ok: true, broadcast })
    }

    return NextResponse.json({ error: 'Unknown broadcast action.' }, { status: 400 })
  } catch (error: any) {
    const message = error?.message || 'Broadcast action failed.'
    const status = /not assigned|cannot|rights/i.test(message) ? 403 : /not found|not live/i.test(message) ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
