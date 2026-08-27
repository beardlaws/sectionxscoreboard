// src/components/layout/AdminLayout.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  PlusCircle,
  Upload,
  CheckSquare,
  Image,
  School,
  Users,
  Trophy,
  Settings,
  Menu,
  X,
  Calendar,
  BarChart2,
  Star,
  Bell,
  Home,
  Newspaper,
  Medal,
  ClipboardCheck,
} from 'lucide-react'

const navSections = [
  {
    label: 'Scores',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/scores/entry', label: 'Enter Score', icon: PlusCircle },
      { href: '/admin/scores/manage', label: 'Manage Games', icon: BarChart2 },
      { href: '/admin/game-center', label: 'Game Center', icon: BarChart2 },
      { href: '/admin/games/recap', label: 'Game Recaps', icon: PlusCircle },
      { href: '/admin/postpone', label: 'Rainout Manager', icon: Trophy },
      { href: '/admin/playoffs', label: 'Playoff Brackets', icon: Trophy },
      { href: '/admin/import', label: 'Import Center', icon: Upload },
      { href: '/admin/schedule-sync', label: 'Schedule Sync', icon: Calendar },
      { href: '/admin/schedule-audit', label: 'Schedule Audit', icon: ClipboardCheck },
      { href: '/admin/roster-audit', label: 'Roster Audit', icon: ClipboardCheck },
      { href: '/admin/submissions', label: 'Submission Queue', icon: CheckSquare },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/spotlight', label: 'Spotlight', icon: Newspaper },
      { href: '/admin/athlete-of-week', label: 'Athlete of Week', icon: Medal },
      { href: '/admin/photos', label: 'Photo Queue', icon: Image },
      { href: '/admin/shoutouts', label: 'Shoutouts', icon: Star },
      { href: '/admin/corrections', label: 'Corrections', icon: Bell },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/admin/contributors', label: 'Contributors', icon: Users },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/admin/seasons', label: 'Seasons', icon: Calendar },
      { href: '/admin/schools', label: 'Schools', icon: School },
      { href: '/admin/teams', label: 'Teams', icon: Users },
      { href: '/admin/sports', label: 'Sports', icon: Trophy },
      { href: '/admin/sponsors', label: 'Sponsors', icon: BarChart2 },
      { href: '/admin/sponsors/analytics', label: 'Sponsor Analytics', icon: BarChart2 },
      { href: '/admin/alerts', label: 'Score Alerts', icon: Bell },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/settings', label: 'Site Settings', icon: Settings },
    ],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const isActive = (href: string) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold" style={{ background: 'var(--accent)', fontFamily: 'var(--font-display)' }}>SX</div>
          <span className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>ADMIN</span>
        </Link>
        <button className="md:hidden" style={{ color: 'var(--text-muted)' }} onClick={() => setSidebarOpen(false)}><X size={18} /></button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {navSections.map(section => (
          <div key={section.label} className="mb-4">
            <div className="section-label px-2 mb-1">{section.label}</div>
            {section.items.map(item => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-colors mb-0.5"
                  style={{ color: active ? '#fff' : 'var(--text-secondary)', background: active ? 'var(--accent)' : 'transparent' }}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <Link href="/" className="flex items-center gap-2 px-2 py-2 rounded text-sm transition-colors" style={{ color: 'var(--text-muted)' }}>
          <Home size={14} /> View Site
        </Link>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden md:flex flex-col w-52 flex-shrink-0" style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}><Sidebar /></aside>

      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-56 md:hidden flex flex-col" style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}><Sidebar /></aside>
        </>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 h-12 flex-shrink-0" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setSidebarOpen(true)} style={{ color: 'var(--text-secondary)' }}><Menu size={20} /></button>
          <span className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)' }}>SECTION X ADMIN</span>
        </div>
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-base)' }}>{children}</main>
      </div>
    </div>
  )
}
