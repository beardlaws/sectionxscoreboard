export type NotificationHealthSnapshot = {
  activeFollows: number
  pending: number
  sent: number
  errors: number
  events: any[]
  deliveries: any[]
}

export interface NotificationHealthRepository {
  getSnapshot(): Promise<NotificationHealthSnapshot>
}
