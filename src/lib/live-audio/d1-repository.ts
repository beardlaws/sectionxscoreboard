import type { BroadcastAssignment, BroadcastRecord } from './types'
import type { BroadcastRepository } from './repository'

function mapBroadcast(row: any): BroadcastRecord {
  return {
    id: row.id,
    gameId: row.game_id,
    title: row.title,
    status: row.status,
    provider: row.provider,
    providerSessionId: row.provider_session_id || null,
    publicEnabled: Boolean(row.public_enabled),
    recordingEnabled: Boolean(row.recording_enabled),
    rightsStatus: row.rights_status,
    rightsHolder: row.rights_holder || null,
    rightsApprovedBy: row.rights_approved_by || null,
    rightsApprovedAt: row.rights_approved_at || null,
    rightsDocumentUrl: row.rights_document_url || null,
    rightsNotes: row.rights_notes || null,
    scheduledAt: row.scheduled_at || null,
    startedAt: row.started_at || null,
    endedAt: row.ended_at || null,
  }
}

function mapAssignment(row: any): BroadcastAssignment {
  return {
    id: row.assignment_id || row.id,
    broadcastId: row.broadcast_id,
    subjectId: row.subject_id,
    displayName: row.display_name || null,
    role: row.role,
    active: Boolean(row.active),
  }
}

export class D1BroadcastRepository implements BroadcastRepository {
  constructor(private readonly db: any) {}

  async getById(id: string) {
    const row = await this.db.prepare('SELECT * FROM broadcasts WHERE id=? LIMIT 1').bind(id).first()
    return row ? mapBroadcast(row) : null
  }

  async listForSubject(subjectId: string) {
    const result = await this.db.prepare(`
      SELECT b.*, a.id AS assignment_id, a.broadcast_id, a.subject_id, a.display_name, a.role, a.active
      FROM broadcast_assignments a
      JOIN broadcasts b ON b.id=a.broadcast_id
      WHERE a.subject_id=? AND a.active=1 AND b.status IN ('draft','scheduled','live')
      ORDER BY COALESCE(b.scheduled_at,b.created_at) ASC
    `).bind(subjectId).all()
    return (result.results || []).map((row: any) => ({
      broadcast: mapBroadcast(row),
      assignment: mapAssignment(row),
    }))
  }

  async getAssignment(broadcastId: string, subjectId: string) {
    const row = await this.db.prepare(`
      SELECT id AS assignment_id,broadcast_id,subject_id,display_name,role,active
      FROM broadcast_assignments
      WHERE broadcast_id=? AND subject_id=? AND active=1
      ORDER BY CASE role WHEN 'producer' THEN 1 WHEN 'broadcaster' THEN 2 WHEN 'color' THEN 3 ELSE 4 END
      LIMIT 1
    `).bind(broadcastId, subjectId).first()
    return row ? mapAssignment(row) : null
  }

  async setProviderSession(broadcastId: string, provider: string, providerSessionId: string) {
    await this.db.prepare(`
      UPDATE broadcasts SET provider=?,provider_session_id=? WHERE id=?
    `).bind(provider, providerSessionId, broadcastId).run()
  }

  async markLive(broadcastId: string, startedAt: string) {
    await this.db.prepare(`
      UPDATE broadcasts SET status='live',public_enabled=1,started_at=COALESCE(started_at,?) WHERE id=?
    `).bind(startedAt, broadcastId).run()
  }

  async markEnded(broadcastId: string, endedAt: string) {
    await this.db.prepare(`
      UPDATE broadcasts SET status='ended',public_enabled=0,ended_at=? WHERE id=?
    `).bind(endedAt, broadcastId).run()
  }

  async recordParticipant(input: {
    broadcastId: string
    subjectId?: string | null
    participantType: 'publisher' | 'listener'
    providerParticipantId?: string | null
    userAgent?: string | null
  }) {
    const id = crypto.randomUUID()
    await this.db.prepare(`
      INSERT INTO broadcast_participant_sessions
      (id,broadcast_id,subject_id,participant_type,provider_participant_id,joined_at,user_agent)
      VALUES (?,?,?,?,?,?,?)
    `).bind(
      id,
      input.broadcastId,
      input.subjectId || null,
      input.participantType,
      input.providerParticipantId || null,
      new Date().toISOString(),
      input.userAgent || null,
    ).run()
    return id
  }

  async logEvent(input: {
    broadcastId: string
    eventType: string
    actorSubjectId?: string | null
    payload?: unknown
  }) {
    await this.db.prepare(`
      INSERT INTO broadcast_events (id,broadcast_id,event_type,actor_subject_id,payload,created_at)
      VALUES (?,?,?,?,?,?)
    `).bind(
      crypto.randomUUID(),
      input.broadcastId,
      input.eventType,
      input.actorSubjectId || null,
      input.payload === undefined ? null : JSON.stringify(input.payload),
      new Date().toISOString(),
    ).run()
  }
}
