export type BroadcastStatus = 'draft' | 'scheduled' | 'live' | 'ended' | 'canceled'
export type BroadcastRole = 'producer' | 'broadcaster' | 'color' | 'sideline' | 'scorekeeper'
export type BroadcastRightsStatus = 'pending' | 'approved' | 'not_required' | 'denied' | 'expired'
export type LiveAudioParticipantRole = 'publisher' | 'listener'

export interface BroadcastRecord {
  id: string
  gameId: string
  title: string
  status: BroadcastStatus
  provider: string
  providerSessionId: string | null
  publicEnabled: boolean
  recordingEnabled: boolean
  rightsStatus: BroadcastRightsStatus
  rightsHolder: string | null
  rightsApprovedBy: string | null
  rightsApprovedAt: string | null
  rightsDocumentUrl: string | null
  rightsNotes: string | null
  scheduledAt: string | null
  startedAt: string | null
  endedAt: string | null
}

export interface BroadcastAssignment {
  id: string
  broadcastId: string
  subjectId: string
  displayName: string | null
  role: BroadcastRole
  active: boolean
}

export interface CreateLiveAudioSessionInput {
  broadcastId: string
  title: string
}

export interface LiveAudioSession {
  provider: string
  providerSessionId: string
}

export interface CreateParticipantInput {
  providerSessionId: string
  subjectId: string
  displayName: string
  role: LiveAudioParticipantRole
}

export interface LiveAudioParticipantCredential {
  providerParticipantId: string
  token: string
}

export interface LiveAudioProvider {
  readonly name: string
  createSession(input: CreateLiveAudioSessionInput): Promise<LiveAudioSession>
  createParticipant(input: CreateParticipantInput): Promise<LiveAudioParticipantCredential>
  endSession(providerSessionId: string): Promise<void>
}
