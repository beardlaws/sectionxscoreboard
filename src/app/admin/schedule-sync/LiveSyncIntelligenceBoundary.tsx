'use client'

import { useEffect, type ReactNode } from 'react'

type ScanMeta = { teamId:string; seasonId:string; sportId:string }
type Tracked = { sourceTeamId:string; diff:any; seenAt:number }

const trackedGames = new Map<string, Map<string, Tracked>>()
const STALE_AFTER_MS = 20 * 60 * 1000

function normalizeText(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\bjunior senior high school\b/g, 'jr sr hs')
    .replace(/\bjunior high school\b/g, 'jhs')
    .replace(/\bmiddle school\b/g, 'ms')
    .replace(/\belementary school\b/g, 'elem')
    .replace(/\bhigh school\b/g, 'hs')
    .replace(/\bcentral school district\b/g, 'central')
    .replace(/\bcentral school\b/g, 'central')
    .replace(/\bcsd\b/g, 'central')
    .replace(/\bgymnasium\b/g, 'gym')
    .replace(/\bmain gym\b/g, 'gym')
    .replace(/\bathletic fields?\b/g, 'field')
    .replace(/\bsoccer pitch\b/g, 'soccer field')
    .replace(/\bfootball stadium\b/g, 'football field')
    .replace(/\bbaseball diamond\b/g, 'baseball field')
    .replace(/\bsoftball diamond\b/g, 'softball field')
    .replace(/\bice arena\b/g, 'arena')
    .replace(/\bice rink\b/g, 'rink')
    .replace(/\bswimming pool\b/g, 'pool')
    .replace(/\s+/g, ' ')
    .trim()
}

function venueFingerprint(value: unknown) {
  return normalizeText(value)
    .replace(/\bshow details\b.*$/i, '')
    .replace(/\bnormal\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function venueEquivalent(aValue: unknown, bValue: unknown) {
  const a = venueFingerprint(aValue)
  const b = venueFingerprint(bValue)
  if (a === b) return true
  if (!a || !b) return false
  const shorter = a.length <= b.length ? a : b
  const longer = a.length > b.length ? a : b
  if (shorter.length >= 8 && longer.startsWith(`${shorter} `)) {
    const extra = longer.slice(shorter.length).trim()
    if (/^(?:main )?(?:gym|field|court|stadium|arena|rink|pool|track|complex|campus|auditorium)$/.test(extra)) return true
  }
  return false
}

function normalizeTime(value: unknown) {
  const raw = String(value ?? '').trim()
  const match = raw.match(/^(\d{1,2}):(\d{2})/)
  return match ? `${String(Number(match[1])).padStart(2, '0')}:${match[2]}` : raw.toLowerCase()
}

function normalizeStatus(value: unknown) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return 'scheduled'
  if (raw === 'ppd' || raw === 'postponed') return 'postponed'
  if (raw === 'cancelled' || raw === 'canceled') return 'canceled'
  if (raw === 'in progress' || raw === 'live') return 'live'
  return raw
}

function coreSignature(game: any) {
  return [game?.game_date || '', normalizeTime(game?.game_time), normalizeStatus(game?.status), game?.game_number ?? ''].join('|')
}

function orientationSignature(game: any) {
  return `${game?.home_team_id || ''}|${game?.away_team_id || ''}`
}

function participantIds(diff: any) {
  const game = diff?.incoming || diff?.existing
  return [game?.home_team_id, game?.away_team_id].filter(Boolean) as string[]
}

function pruneOld() {
  const cutoff = Date.now() - STALE_AFTER_MS
  for (const [gameKey, bySource] of trackedGames) {
    for (const [sourceId, item] of bySource) if (item.seenAt < cutoff) bySource.delete(sourceId)
    if (!bySource.size) trackedGames.delete(gameKey)
  }
}

function reconcileTrackedGame(bySource: Map<string, Tracked>) {
  const entries = [...bySource.values()]
  if (entries.length < 2) return

  const ids = participantIds(entries[0].diff)
  if (ids.length !== 2) return
  const relevant = ids.map(id => bySource.get(id)).filter(Boolean) as Tracked[]
  if (relevant.length !== 2) return

  const sourceIds = relevant.map(item => item.sourceTeamId)
  const removed = relevant.filter(item => item.diff?.kind === 'possible_removed')
  const present = relevant.filter(item => item.diff?.kind !== 'possible_removed' && item.diff?.incoming)

  if (removed.length && present.length) {
    for (const item of removed) {
      item.diff.kind = 'unchanged'
      item.diff.safe = true
      item.diff.reconciliation_status = undefined
      item.diff.cross_source_count = 2
      item.diff.cross_source_team_ids = sourceIds
      item.diff.note = 'Dismissed removal noise: this game is missing from one fresh team page, but the opponent fresh source still carries the existing game. Keep the database record; no removal review is needed.'
    }
  } else if (removed.length === 2) {
    for (const item of removed) {
      item.diff.safe = false
      item.diff.cross_source_count = 2
      item.diff.cross_source_team_ids = sourceIds
      item.diff.note = 'High-confidence removal candidate: both fresh Section X team sources omit this previously imported game. It still requires explicit human review; Live Sync never deletes games automatically.'
    }
    return
  }

  const current = relevant.filter(item => item.diff?.incoming)
  if (current.length !== 2) return
  const [a, b] = current
  const gameA = a.diff.incoming
  const gameB = b.diff.incoming
  if (coreSignature(gameA) !== coreSignature(gameB)) return

  const orientationA = orientationSignature(gameA)
  const orientationB = orientationSignature(gameB)
  const orientationReviews = current.filter(item => item.diff?.kind === 'details_changed' && /orientation review/i.test(String(item.diff?.note || '')))
  if (orientationReviews.length) {
    if (orientationA === orientationB) {
      const venueSupport = venueEquivalent(gameA?.location, gameB?.location) && !!venueFingerprint(gameA?.location)
      for (const item of orientationReviews) {
        item.diff.cross_source_count = 2
        item.diff.cross_source_team_ids = sourceIds
        item.diff.note = `Two-source structural evidence: both fresh team schedules independently agree on the same home/away orientation, date, time and status${venueSupport ? ', and their venue observations also agree' : ''}. The database orientation is likely stale. Keep this as a manual structural correction; team IDs are never auto-written.`
      }
    } else {
      for (const item of orientationReviews) {
        item.diff.safe = false
        item.diff.reconciliation_status = 'source_conflict'
        item.diff.cross_source_count = 2
        item.diff.cross_source_team_ids = sourceIds
        item.diff.note = 'Fresh team sources disagree on home/away orientation for the same matchup. No structural change should be made until the sources agree.'
      }
    }
  }

  const locationReviews = current.filter(item => item.diff?.kind === 'location_changed')
  if (locationReviews.length) {
    const locationA = gameA?.location
    const locationB = gameB?.location
    if (venueEquivalent(locationA, locationB) && venueFingerprint(locationA)) {
      for (const item of locationReviews) {
        item.diff.cross_source_count = 2
        item.diff.cross_source_team_ids = sourceIds
        item.diff.note = `Two-source venue evidence: both fresh Section X schedules independently agree on the current venue (${String(locationA)}). Review this single venue correction once; it is not a one-sided Arbiter observation.`
      }
    } else if (locationA && locationB) {
      for (const item of locationReviews) {
        item.diff.safe = false
        item.diff.reconciliation_status = 'source_conflict'
        item.diff.cross_source_count = 2
        item.diff.cross_source_team_ids = sourceIds
        item.diff.note = `Fresh Section X sources disagree on venue (${String(locationA)} vs ${String(locationB)}). No venue change should be made until the sources agree.`
      }
    }
  }
}

function enrichComparison(payload: any, meta: ScanMeta) {
  if (!payload?.success || !Array.isArray(payload?.diffs)) return payload
  pruneOld()
  const now = Date.now()
  for (const diff of payload.diffs) {
    if (!diff?.existing_game_id) continue
    const key = `${meta.seasonId}|${meta.sportId}|${diff.existing_game_id}`
    const bySource = trackedGames.get(key) || new Map<string, Tracked>()
    bySource.set(meta.teamId, { sourceTeamId: meta.teamId, diff, seenAt: now })
    trackedGames.set(key, bySource)
    reconcileTrackedGame(bySource)
  }
  return payload
}

export default function LiveSyncIntelligenceBoundary({ children }: { children: ReactNode }) {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const isScheduleCompare = url === '/api/admin/schedule-sync' || url.endsWith('/api/admin/schedule-sync')
      if (!isScheduleCompare || String(init?.method || 'GET').toUpperCase() !== 'POST') return originalFetch(input, init)

      let meta: ScanMeta | null = null
      try {
        if (typeof init?.body === 'string') {
          const body = JSON.parse(init.body)
          if (body?.team_id && body?.season_id && body?.sport_id) meta = { teamId:body.team_id, seasonId:body.season_id, sportId:body.sport_id }
        }
      } catch {}

      const response = await originalFetch(input, init)
      if (!meta || !response.ok) return response
      try {
        const payload = await response.clone().json()
        enrichComparison(payload, meta)
        ;(response as any).json = async () => payload
      } catch {}
      return response
    }) as typeof window.fetch

    return () => { window.fetch = originalFetch }
  }, [])

  return <>{children}</>
}
