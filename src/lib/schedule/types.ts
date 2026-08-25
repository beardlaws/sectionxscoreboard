export type ScheduleProviderId = 'arbiter-scrape' | 'arbiter-api' | 'manual'

export type ScheduleObservationStatus =
  | 'scheduled'
  | 'postponed'
  | 'canceled'
  | 'live'
  | 'final'
  | 'unknown'

export type NormalizedScheduleObservation = {
  provider: ScheduleProviderId
  providerEventId?: string | null
  sourceTeamId?: string | null
  observedAt: string
  gameDate: string | null
  gameTime: string | null
  status: ScheduleObservationStatus
  location: string | null
  homeTeamId: string | null
  awayTeamId: string | null
  externalHomeName?: string | null
  externalAwayName?: string | null
  rawSourceUrl?: string | null
  raw?: unknown
}

export type ReconciliationDecision =
  | 'agree'
  | 'safe_update'
  | 'source_disagreement'
  | 'insufficient_evidence'
  | 'possible_reschedule'
  | 'possible_removal'
  | 'new_game'
  | 'manual_review'

export type ReconciliationResult = {
  decision: ReconciliationDecision
  canonical?: NormalizedScheduleObservation | null
  observations: NormalizedScheduleObservation[]
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  disagreementFields: Array<'date' | 'time' | 'status' | 'location' | 'orientation'>
  writeAllowed: boolean
}

export interface ScheduleProvider {
  readonly id: ScheduleProviderId
  fetchSchedule(input: {
    teamId: string
    seasonId: string
    sportId: string
    sourceUrl?: string | null
  }): Promise<NormalizedScheduleObservation[]>
}
