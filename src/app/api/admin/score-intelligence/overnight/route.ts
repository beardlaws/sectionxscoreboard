import { NextRequest, NextResponse } from 'next/server'
import { runNorthCountrySportsSweep } from '@/lib/scores/north-country-sports'
import { sectionXDateOffset } from '@/lib/sectionx-time'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CONFIRM = 'RUN_OVERNIGHT_SCORE_SWEEP'

function safeDate(value: unknown) {
  const date = String(value || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : sectionXDateOffset(-1)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    if (body?.confirm !== CONFIRM) {
      return NextResponse.json({
        ok: false,
        error: 'Explicit confirmation required.',
        requiredConfirmation: CONFIRM,
      }, { status: 400 })
    }

    const date = safeDate(body?.date)
    const result = await runNorthCountrySportsSweep(date, true)
    return NextResponse.json(result, { status: result.ok ? 200 : 207 })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Overnight score sweep failed',
    }, { status: 500 })
  }
}
