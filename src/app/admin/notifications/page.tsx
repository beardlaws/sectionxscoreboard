import AdminLayout from '@/components/layout/AdminLayout'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function fmt(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York',
  }).format(new Date(value))
}

function maskEmail(value?: string | null) {
  if (!value) return '—'
  const [local, domain] = value.split('@')
  if (!domain) return '—'
  return `${local.slice(0, 2)}•••@${domain}`
}

function StatusPill({ value }: { value?: string | null }) {
  const status = value || 'unknown'
  const styles = status === 'sent'
    ? 'border-emerald-400/20 bg-emerald-400/[.07] text-emerald-300'
    : status === 'error'
      ? 'border-red-400/20 bg-red-400/[.07] text-red-300'
      : status === 'pending'
        ? 'border-yellow-300/20 bg-yellow-300/[.06] text-yellow-200'
        : 'border-white/10 bg-white/[.04] text-white/45'
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${styles}`}>{status}</span>
}

export default async function NotificationHealthPage() {
  const db = createAdminClient()
  const [
    pendingResult,
    errorResult,
    sentResult,
    activeFollowsResult,
    eventsResult,
    deliveriesResult,
  ] = await Promise.all([
    db.from('fan_notification_events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('fan_notification_events').select('*', { count: 'exact', head: true }).eq('status', 'error'),
    db.from('fan_notification_events').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
    db.from('fan_follow_preferences').select('*', { count: 'exact', head: true }).eq('active', true),
    db.from('fan_notification_events').select('id,event_type,status,game_id,photo_id,created_at,processed_at,last_error').order('created_at', { ascending: false }).limit(20),
    db.from('fan_notification_deliveries').select('id,event_id,email,status,provider,provider_id,error,created_at,sent_at').order('created_at', { ascending: false }).limit(25),
  ])

  const queryErrors = [pendingResult.error, errorResult.error, sentResult.error, activeFollowsResult.error, eventsResult.error, deliveriesResult.error].filter(Boolean)
  const events = eventsResult.data || []
  const deliveries = deliveriesResult.data || []

  return <AdminLayout>
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-300">Fan Alerts</div>
        <h1 className="mt-1 text-3xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>Notification Health</h1>
        <p className="mt-2 text-sm text-white/45">Live visibility into the Section X follow queue and outbound delivery audit.</p>
      </div>

      {queryErrors.length > 0 && <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/[.05] p-4 text-sm text-red-300">One or more notification health queries failed. Check the server logs before relying on these totals.</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        {[
          ['Active follows', activeFollowsResult.count ?? 0, 'Fans currently opted in'],
          ['Pending', pendingResult.count ?? 0, 'Waiting for dispatcher'],
          ['Sent events', sentResult.count ?? 0, 'Completed event batches'],
          ['Errors', errorResult.count ?? 0, 'Needs attention'],
        ].map(([label, value, note]) => <div key={String(label)} className="card p-4">
          <div className="text-[10px] uppercase tracking-widest text-white/35 font-black">{label}</div>
          <div className="mt-2 text-3xl font-black text-white">{String(value)}</div>
          <div className="mt-1 text-xs text-white/35">{note}</div>
        </div>)}
      </div>

      <section className="mb-7">
        <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-black uppercase tracking-widest text-white">Recent events</h2><span className="text-xs text-white/30">Newest 20</span></div>
        <div className="overflow-x-auto rounded-xl border border-white/[.07] bg-black/20">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[.07] text-white/35 uppercase tracking-wider"><tr><th className="p-3">Event</th><th className="p-3">Status</th><th className="p-3">Created</th><th className="p-3">Processed</th><th className="p-3">Error</th></tr></thead>
            <tbody>{events.length ? events.map((event: any) => <tr key={event.id} className="border-b border-white/[.05] last:border-0"><td className="p-3 font-bold text-white">{event.event_type}</td><td className="p-3"><StatusPill value={event.status}/></td><td className="p-3 text-white/45">{fmt(event.created_at)}</td><td className="p-3 text-white/45">{fmt(event.processed_at)}</td><td className="p-3 max-w-xs truncate text-red-300/70" title={event.last_error || ''}>{event.last_error || '—'}</td></tr>) : <tr><td colSpan={5} className="p-6 text-center text-white/30">No notification events yet.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-black uppercase tracking-widest text-white">Recent deliveries</h2><span className="text-xs text-white/30">Newest 25 · emails masked</span></div>
        <div className="overflow-x-auto rounded-xl border border-white/[.07] bg-black/20">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/[.07] text-white/35 uppercase tracking-wider"><tr><th className="p-3">Recipient</th><th className="p-3">Status</th><th className="p-3">Provider</th><th className="p-3">Sent</th><th className="p-3">Provider ID / error</th></tr></thead>
            <tbody>{deliveries.length ? deliveries.map((delivery: any) => <tr key={delivery.id} className="border-b border-white/[.05] last:border-0"><td className="p-3 font-mono text-white/60">{maskEmail(delivery.email)}</td><td className="p-3"><StatusPill value={delivery.status}/></td><td className="p-3 text-white/55">{delivery.provider || '—'}</td><td className="p-3 text-white/45">{fmt(delivery.sent_at || delivery.created_at)}</td><td className={`p-3 max-w-sm truncate ${delivery.error ? 'text-red-300/70' : 'text-white/30'}`} title={delivery.error || delivery.provider_id || ''}>{delivery.error || delivery.provider_id || '—'}</td></tr>) : <tr><td colSpan={5} className="p-6 text-center text-white/30">No delivery attempts yet.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>
  </AdminLayout>
}
