import { arbiterLocationsEquivalent } from '@/lib/arbiter-location'
import {
  normalizeScheduleDate,
  normalizeScheduleStatus,
  normalizeScheduleTime,
} from './normalize'
import type {
  NormalizedScheduleObservation,
  ReconciliationResult,
} from './types'

function participantPair(observation: NormalizedScheduleObservation) {
  if (!observation.homeTeamId || !observation.awayTeamId) return null
  return [observation.homeTeamId, observation.awayTeamId].sort().join('|')
}

export function observationGameKey(observation: NormalizedScheduleObservation) {
  if (observation.providerEventId) {
    return `${observation.provider}:${observation.providerEventId}`
  }

  const pair = participantPair(observation)
  const date = normalizeScheduleDate(observation.gameDate) || 'no-date'
  if (pair) return `internal:${pair}:${date}`

  return [
    'external',
    observation.homeTeamId || observation.externalHomeName || 'unknown-home',
    observation.awayTeamId || observation.externalAwayName || 'unknown-away',
    date,
  ].join(':')
}

function uniqueNonNull(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function statuses(observations: NormalizedScheduleObservation[]) {
  return uniqueNonNull(
    observations.map(observation => normalizeScheduleStatus(observation.status))
  )
}

function locationsDisagree(observations: NormalizedScheduleObservation[]) {
  const values = observations
    .map(observation => observation.location)
    .filter((value): value is string => Boolean(value))
  if (values.length < 2) return false
  const first = values[0]
  return values.slice(1).some(value => !arbiterLocationsEquivalent(first, value))
}

export function reconcileScheduleObservations(
  observations: NormalizedScheduleObservation[]
): ReconciliationResult {
  if (!observations.length) {
    return {
      decision: 'insufficient_evidence',
      canonical: null,
      observations: [],
      confidence: 'low',
      reasons: ['No schedule observations were supplied.'],
      disagreementFields: [],
      writeAllowed: false,
    }
  }

  const disagreementFields: ReconciliationResult['disagreementFields'] = []
  const reasons: string[] = []
  const pairs = uniqueNonNull(observations.map(participantPair))
  const dates = uniqueNonNull(observations.map(item => normalizeScheduleDate(item.gameDate)))
  const times = uniqueNonNull(observations.map(item => normalizeScheduleTime(item.gameTime)))
  const statusValues = statuses(observations)

  if (pairs.length > 1) disagreementFields.push('orientation')
  if (dates.length > 1) disagreementFields.push('date')
  if (times.length > 1) disagreementFields.push('time')
  if (statusValues.length > 1) disagreementFields.push('status')
  if (locationsDisagree(observations)) disagreementFields.push('location')

  if (disagreementFields.length) {
    reasons.push(`Sources disagree on: ${disagreementFields.join(', ')}.`)
    return {
      decision: dates.length > 1 ? 'possible_reschedule' : 'source_disagreement',
      canonical: null,
      observations,
      confidence: 'low',
      reasons,
      disagreementFields,
      writeAllowed: false,
    }
  }

  const canonical = observations[0]
  const pair = participantPair(canonical)
  const sourceTeamIds = new Set(
    observations.map(item => item.sourceTeamId).filter((id): id is string => Boolean(id))
  )
  const participantIds = new Set(
    [canonical.homeTeamId, canonical.awayTeamId].filter((id): id is string => Boolean(id))
  )
  const bothInternalParticipantsObserved =
    participantIds.size === 2 && [...participantIds].every(id => sourceTeamIds.has(id))
  const canonicalApiObservation = observations.some(
    item => item.provider === 'arbiter-api' && Boolean(item.providerEventId)
  )

  if (pair && bothInternalParticipantsObserved) {
    reasons.push('Both Section X participants independently report the same canonical game details.')
    return {
      decision: 'agree',
      canonical,
      observations,
      confidence: 'high',
      reasons,
      disagreementFields: [],
      writeAllowed: true,
    }
  }

  if (canonicalApiObservation) {
    reasons.push('A canonical Arbiter API event ID supports this observation.')
    return {
      decision: 'agree',
      canonical,
      observations,
      confidence: 'high',
      reasons,
      disagreementFields: [],
      writeAllowed: true,
    }
  }

  if (observations.length > 1) {
    reasons.push('Multiple observations agree, but they do not yet prove both Section X participants independently reported the game.')
    return {
      decision: 'agree',
      canonical,
      observations,
      confidence: 'medium',
      reasons,
      disagreementFields: [],
      writeAllowed: false,
    }
  }

  reasons.push('Only one source observation is available. Keep the game read-only until corroborated or backed by a canonical provider event.')
  return {
    decision: 'insufficient_evidence',
    canonical,
    observations,
    confidence: 'low',
    reasons,
    disagreementFields: [],
    writeAllowed: false,
  }
}
