import type { BroadcastRepository } from './repository'
import type { LiveAudioProvider } from './types'

export class LiveAudioService {
  constructor(
    private readonly repository: BroadcastRepository,
    private readonly provider: LiveAudioProvider,
  ) {}

  async listAssigned(subjectId: string) {
    return this.repository.listForSubject(subjectId)
  }

  async createPublisherCredential(input: {
    broadcastId: string
    subjectId: string
    displayName: string
    userAgent?: string | null
  }) {
    const broadcast = await this.repository.getById(input.broadcastId)
    if (!broadcast) throw new Error('Broadcast not found.')
    if (broadcast.status === 'ended' || broadcast.status === 'canceled') throw new Error('This broadcast is no longer active.')
    if (!['approved', 'not_required'].includes(broadcast.rightsStatus)) {
      throw new Error('Broadcast rights have not been cleared yet.')
    }

    const assignment = await this.repository.getAssignment(input.broadcastId, input.subjectId)
    if (!assignment) throw new Error('You are not assigned to this broadcast.')
    if (!['producer', 'broadcaster', 'color', 'sideline'].includes(assignment.role)) {
      throw new Error('Your assignment does not allow microphone access.')
    }

    let providerSessionId = broadcast.providerSessionId
    if (!providerSessionId) {
      const session = await this.provider.createSession({ broadcastId: broadcast.id, title: broadcast.title })
      providerSessionId = session.providerSessionId
      await this.repository.setProviderSession(broadcast.id, session.provider, session.providerSessionId)
      await this.repository.logEvent({
        broadcastId: broadcast.id,
        eventType: 'provider-session-created',
        actorSubjectId: input.subjectId,
        payload: { provider: session.provider, providerSessionId: session.providerSessionId },
      })
    }

    const credential = await this.provider.createParticipant({
      providerSessionId,
      subjectId: input.subjectId,
      displayName: input.displayName || assignment.displayName || 'Section X Broadcaster',
      role: 'publisher',
    })

    await this.repository.recordParticipant({
      broadcastId: broadcast.id,
      subjectId: input.subjectId,
      participantType: 'publisher',
      providerParticipantId: credential.providerParticipantId,
      userAgent: input.userAgent || null,
    })
    await this.repository.logEvent({
      broadcastId: broadcast.id,
      eventType: 'publisher-credential-issued',
      actorSubjectId: input.subjectId,
      payload: { role: assignment.role },
    })

    return { broadcast: { ...broadcast, providerSessionId }, assignment, credential }
  }

  async goLive(input: { broadcastId: string; subjectId: string }) {
    const broadcast = await this.repository.getById(input.broadcastId)
    if (!broadcast) throw new Error('Broadcast not found.')
    if (!['approved', 'not_required'].includes(broadcast.rightsStatus)) throw new Error('Broadcast rights have not been cleared yet.')
    const assignment = await this.repository.getAssignment(input.broadcastId, input.subjectId)
    if (!assignment || !['producer', 'broadcaster'].includes(assignment.role)) throw new Error('You cannot start this broadcast.')
    const startedAt = new Date().toISOString()
    await this.repository.markLive(broadcast.id, startedAt)
    await this.repository.logEvent({ broadcastId: broadcast.id, eventType: 'broadcast-live', actorSubjectId: input.subjectId })
    return this.repository.getById(broadcast.id)
  }

  async createListenerCredential(input: {
    broadcastId: string
    displayName?: string
    userAgent?: string | null
  }) {
    const broadcast = await this.repository.getById(input.broadcastId)
    if (!broadcast || broadcast.status !== 'live' || !broadcast.publicEnabled) throw new Error('This broadcast is not live.')
    if (!broadcast.providerSessionId) throw new Error('Live audio session is not ready yet.')

    const anonymousSubject = `listener:${crypto.randomUUID()}`
    const credential = await this.provider.createParticipant({
      providerSessionId: broadcast.providerSessionId,
      subjectId: anonymousSubject,
      displayName: input.displayName || 'Section X Listener',
      role: 'listener',
    })
    await this.repository.recordParticipant({
      broadcastId: broadcast.id,
      subjectId: null,
      participantType: 'listener',
      providerParticipantId: credential.providerParticipantId,
      userAgent: input.userAgent || null,
    })
    return { broadcast, credential }
  }

  async endBroadcast(input: { broadcastId: string; subjectId: string }) {
    const broadcast = await this.repository.getById(input.broadcastId)
    if (!broadcast) throw new Error('Broadcast not found.')
    const assignment = await this.repository.getAssignment(input.broadcastId, input.subjectId)
    if (!assignment || !['producer', 'broadcaster'].includes(assignment.role)) throw new Error('You cannot end this broadcast.')
    if (broadcast.providerSessionId) await this.provider.endSession(broadcast.providerSessionId)
    const endedAt = new Date().toISOString()
    await this.repository.markEnded(broadcast.id, endedAt)
    await this.repository.logEvent({ broadcastId: broadcast.id, eventType: 'broadcast-ended', actorSubjectId: input.subjectId })
    return this.repository.getById(broadcast.id)
  }
}
