import { NextRequest, NextResponse } from 'next/server'
import { runNorthCountrySportsSweep } from '@/lib/scores/north-country-sports'
import { sectionXDate, sectionXDateOffset } from '@/lib/sectionx-time'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function easternHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  return Number(hour)
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const hour = easternHour(now)
  const runHours = new Set([22, 0, 2, 4, 5])

  if (!runHours.has(hour)) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'Outside configured Eastern overnight sweep hours.',
      easternHour: hour,
    })
  }

  const date = hour >= 18 ? sectionXDate(now) : sectionXDateOffset(-1, now)

  try {
    const result = await runNorthCountrySportsSweep(date, true)
    return NextResponse.json({
      ...result,
      automated: true,
      easternHour: hour,
    }, { status: result.ok ? 200 : 207 })
  } catch (error) {
    console.error('Overnight score sweep failed:', error)
    return NextResponse.json({
      ok: false,
      automated: true,
      date,
      easternHour: hour,
      error: error instanceof Error ? error.message : 'Overnight score sweep failed',
    }, { status: 500 })
  }
}
