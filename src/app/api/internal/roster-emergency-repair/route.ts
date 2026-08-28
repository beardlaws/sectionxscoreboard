import { NextRequest, NextResponse } from 'next/server'
import { GET as reconcileRosters } from '@/app/api/cron/arbiter-rosters-v2/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const REPAIR_KEY = 'sx-roster-repair-20260828-7f3c91'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== REPAIR_KEY) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const internalReq = new NextRequest('http://sectionx.internal/api/cron/arbiter-rosters-v2', {
    method: 'GET',
    headers: { 'x-sectionx-internal-repair': REPAIR_KEY },
  })

  const response = await reconcileRosters(internalReq)
  const result = await response.json()
  return NextResponse.json({ repair: true, ...result }, { status: response.status })
}
