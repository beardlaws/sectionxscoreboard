import { cleanArbiterLocation } from '@/lib/arbiter-location'
import type { ScheduleObservationStatus } from './types'

export function normalizeScheduleDate(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!match) return raw
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

export function normalizeScheduleTime(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null

  const twelveHour = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (twelveHour) {
    let hour = Number(twelveHour[1])
    const minute = twelveHour[2]
    const meridiem = twelveHour[3].toUpperCase()
    if (meridiem === 'AM' && hour === 12) hour = 0
    if (meridiem === 'PM' && hour !== 12) hour += 12
    return `${String(hour).padStart(2, '0')}:${minute}:00`
  }

  const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/)
  if (twentyFourHour) {
    return `${String(Number(twentyFourHour[1])).padStart(2, '0')}:${twentyFourHour[2]}:00`
  }

  return raw.toLowerCase().replace(/\s+/g, ' ')
}

export function normalizeScheduleStatus(value: unknown): ScheduleObservationStatus {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  if (!raw || raw === 'scheduled') return 'scheduled'
  if (raw === 'ppd' || raw === 'postponed') return 'postponed'
  if (raw === 'cancelled' || raw === 'canceled') return 'canceled'
  if (raw === 'live' || raw === 'in progress') return 'live'
  if (raw === 'final') return 'final'
  return 'unknown'
}

export function normalizeScheduleLocation(value: unknown): string | null {
  return cleanArbiterLocation(value) || null
}

export function normalizeName(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
