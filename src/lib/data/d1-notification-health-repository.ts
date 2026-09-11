import type { NotificationHealthRepository, NotificationHealthSnapshot } from './notification-health-repository'

export class D1NotificationHealthRepository implements NotificationHealthRepository {
  constructor(private db: any) {}

  async getSnapshot(): Promise<NotificationHealthSnapshot> {
    const [activeFollows,pending,sent,errors,events,deliveries] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) AS count FROM fan_follow_preferences WHERE active=1').first(),
      this.db.prepare("SELECT COUNT(*) AS count FROM fan_notification_events WHERE status='pending'").first(),
      this.db.prepare("SELECT COUNT(*) AS count FROM fan_notification_events WHERE status='sent'").first(),
      this.db.prepare("SELECT COUNT(*) AS count FROM fan_notification_events WHERE status='error'").first(),
      this.db.prepare('SELECT id,event_type,status,game_id,photo_id,created_at,processed_at,last_error FROM fan_notification_events ORDER BY created_at DESC LIMIT 20').all(),
      this.db.prepare('SELECT id,event_id,email,status,provider,provider_id,error,created_at,sent_at FROM fan_notification_deliveries ORDER BY created_at DESC LIMIT 25').all(),
    ])
    return {
      activeFollows:Number(activeFollows?.count||0),
      pending:Number(pending?.count||0),
      sent:Number(sent?.count||0),
      errors:Number(errors?.count||0),
      events:events.results||[],
      deliveries:deliveries.results||[],
    }
  }
}
