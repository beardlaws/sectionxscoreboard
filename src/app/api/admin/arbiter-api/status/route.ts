import { NextResponse } from 'next/server'
import {
  ArbiterApiError,
  arbiterApi,
  getArbiterConfigStatus,
} from '@/lib/arbiter/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = getArbiterConfigStatus()

  if (!config.configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      config,
      message:
        'Arbiter Partner API credentials are not configured. Add ARBITER_CLIENT_ID and ARBITER_CLIENT_SECRET in Vercel.',
    })
  }

  try {
    const identity = await arbiterApi.identity()

    return NextResponse.json({
      ok: true,
      configured: true,
      config,
      authenticated: true,
      identity,
    })
  } catch (error) {
    console.error('Arbiter API status error:', error)

    if (error instanceof ArbiterApiError) {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          authenticated: false,
          config,
          error: error.message,
          arbiterStatus: error.status,
          details: error.details,
        },
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        configured: true,
        authenticated: false,
        config,
        error: error instanceof Error ? error.message : 'Unknown Arbiter API error',
      },
      { status: 500 }
    )
  }
}
