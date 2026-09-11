// Legacy compatibility endpoint kept for callers that still post to /admin/arbiter-rosters.
// The canonical roster publisher lives at /api/admin/arbiter-rosters and is D1-native.

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const target = new URL('/api/admin/arbiter-rosters', req.url)
  const response = await fetch(target, {
    method: 'POST',
    headers: {
      'content-type': req.headers.get('content-type') || 'application/json',
      cookie: req.headers.get('cookie') || '',
      authorization: req.headers.get('authorization') || '',
    },
    body: await req.text(),
  })

  const body = await response.text()
  return new NextResponse(body, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
    },
  })
}
