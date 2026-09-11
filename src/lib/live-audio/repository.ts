import type { BroadcastAssignment, BroadcastRecord } from './types'

export interface BroadcastRepository {
  getById(id: string): Promise<BroadcastRecord | null>
  getLiveByGame(gameId: string): Promise<BroadcastRecord | null>
  listForSubject(subjectId: string): Promise<Array<{ broadcast: BroadcastRecord; assignment: BroadcastAssignment }>>
  getAssignment(broadcastId: string, subjectId: string): Promise<BroadcastAssignment | null>
  setProviderSession(broadcastId: string, provider: string, providerSessionId: string): Promise<void>
  markLive(broadcastId: string, startedAt: string): Promise<void>
  markEnded(broadcastId: string, endedAt: string): Promise<void>
  recordParticipant(input: {
    broadcastId: string
    subjectId?: string | null
    participantType: 'publisher' | 'listener'
    providerParticipantId?: string | null
    userAgent?: string | null
  }): Promise<string>
  logEvent(input: {
    broadcastId: string
    eventType: string
    actorSubjectId?: string | null
    payload?: unknown
  }): Promise<void>
}
