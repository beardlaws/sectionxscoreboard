// src/app/admin/page.tsx
import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/layout/AdminLayout'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  PlusCircle, Upload, CheckSquare, Image, Star, Bell,
  Calendar, Trophy, School, Users, BarChart2
} from 'lucide-react'

export const revalidate = 0

export default async function AdminDashboard() {
  const supabase = createClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [
    { count: pendingSubmissions },
    { count: pendingPhotos },
    { count: pendingCorrections },
    { data: activeSeason },
    { count: todayGames },
    { count: totalGames },
    { count: totalSchools },
  ] = await Promise.all([
    supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('photos').select('*', { count: 'exact', head: true }).eq('approved', false),
    supabase.from('correction_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('seasons').select('*').eq('is_active', true).single(),
    supabase.from('games').select('*', { count: 'exact', head: true }).eq('game_date', today),
    supabase.from('games').select('*', { count: 'exact', head: true }),
    supabase.from('schools').select('*', { count: 'exact', head: true }).eq('active', true),
  ])

  const alerts = [
    pendingSubmissions && pendingSubmissions > 0
      ? { label: `${pendingSubmissions} pending score submission${pendingSubmissions !== 1 ? 's' : ''}`, href: '/admin/submissions', color: 'amber' }
      : null,
    pendingPhotos && pendingPhotos > 0
      ? { label: `${pendingPhotos} photo${pendingPhotos !== 1 ? 's' : ''} awaiting approval`, href: '/admin/photos', color: 'blue' }
      : null,
    pendingCorrections && pendingCorrections > 0
      ? { label: `${pendingCorrections} correction request${pendingCorrections !== 1 ? 's' : ''}`, href: '/admin/corrections', color: 'red' }
      : null,
  ].filter(Boolean)

  const quickActions = [
    { href: '/admin/scores/entry', icon: PlusCircle, label: 'Enter Score', desc: 'Add a single game result' },
    { href: '/admin/scores/manage', icon: BarChart2, label: 'Manage Games', desc: 'Edit or delete games' },
    { href: '/admin/import', icon: Upload, label: 'Import Center', desc: 'Paste or upload scores/schedules' },
    { href: '/admin/submissions', icon: CheckSquare, label: 'Review Submissions', desc: `${pendingSubmissions || 0} pending` },
    { href: '/admin/photos', icon: Image, label: 'Photo Queue', desc: `${pendingPhotos || 0} pending` },
    { href: '/admin/seasons', icon: Calendar, label: 'Seasons', desc: 'Manage active season' },
    { href: '/admin/teams', icon: Users, label: 'Teams', desc: 'Activate/deactivate teams' },
  ]

  return (
    <AdminLayout>
      <div className="p-4 max-w-4xl">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Admin Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {(activeSeason as any)?.name || 'No active season'} · {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2 mb-5">
            {alerts.map((alert, i) => alert && (
              <Link
                key={i}
                href={alert.href}
                className="flex items-center justify-between p-3 rounded-lg text-sm"
                style={{
                  background: alert.color === 'amber' ? 'rgba(251,191,36,0.1)' : alert.color === 'red' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                  border: `1px solid ${alert.color === 'amber' ? 'rgba(251,191,36,0.3)' : alert.color === 'red' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
                  color: alert.color === 'amber' ? '#fbbf24' : alert.color === 'red' ? '#f87171' : '#93c5fd',
                }}
              >
                <span>⚠️ {alert.label}</span>
                <span className="text-xs opacity-70">Review →</span>
              </Link>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Today's Games", value: todayGames || 0 },
            { label: 'Total Games', value: totalGames || 0 },
            { label: 'Schools', value: totalSchools || 0 },
            { label: 'Season', value: (activeSeason as any)?.season_type || '—' },
          ].map(stat => (
            <div key={stat.label} className="card p-4 text-center">
              <div
                className="text-2xl font-bold text-white"
                style={{ fontFamily: 'var(--font-scoreboard)' }}
              >
                {stat.value}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick actions — large mobile-friendly buttons */}
        <h2 className="section-label mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickActions.map(action => {
            const Icon = action.icon
            return (
              <Link key={action.href} href={action.href} className="admin-action-btn">
                <Icon size={22} style={{ color: 'var(--accent-bright)' }} />
                <div>
                  <div className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                    {action.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{action.desc}</div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </AdminLayout>
  )
}
