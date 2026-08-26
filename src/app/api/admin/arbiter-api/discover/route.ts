import { NextResponse } from 'next/server'
import { ArbiterApiError, arbiterApi, getArbiterConfigStatus } from '@/lib/arbiter/client'

export const dynamic = 'force-dynamic'

function count(value: unknown): number | null {
  return Array.isArray(value) ? value.length : value == null ? 0 : null
}

export async function GET() {
  const config = getArbiterConfigStatus()

  if (!config.configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: 'Add ARBITER_CLIENT_ID and ARBITER_CLIENT_SECRET in Vercel first.',
    })
  }

  try {
    const [identity, groups, sports, levels] = await Promise.all([
      arbiterApi.identity(),
      arbiterApi.groups(),
      arbiterApi.sports(),
      arbiterApi.levels(),
    ])

    let teams: unknown = null
    let teamsError: string | null = null

    try {
      teams = await arbiterApi.teams()
    } catch (error) {
      teamsError =
        error instanceof ArbiterApiError
          ? `${error.message} (${error.status})`
          : error instanceof Error
            ? error.message
            : 'Unknown team discovery error'
    }

    return NextResponse.json({
      ok: true,
      authenticated: true,
      summary: {
        groups: count(groups),
        sports: count(sports),
        levels: count(levels),
        teams: count(teams),
      },
      identity,
      groups,
      sports,
      levels,
      teams,
      teamsError,
    })
  } catch (error) {
    console.error('Arbiter API discovery error:', error)

    if (error instanceof ArbiterApiError) {
      return NextResponse.json(
        {
          ok: false,
          authenticated: false,
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
        authenticated: false,
        error: error instanceof Error ? error.message : 'Unknown Arbiter discovery error',
      },
      { status: 500 }
    )
  }
}
