// src/components/layout/PublicLayout.tsx
'use client'
import ScoreTicker from './ScoreTicker'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, Search, Trophy, Calendar, BarChart2, Camera, Megaphone } from 'lucide-react'
import { ALL_SPORTS } from '@/lib/constants'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sportsMenuOpen, setSportsMenuOpen] = useState(false)
  const pathname = usePathname()

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/scores', label: 'Scores' },
    { href: '/standings', label: 'Standings' },
    { href: '/schools', label: 'Schools' },
    { href: '/photos', label: 'Photos' },
  ]

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ background: 'rgba(5,8,15,0.92)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }} className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 900, letterSpacing: '0.02em', boxShadow: '0 0 12px rgba(37,99,235,0.4)' }}
              >
                SX
              </div>
              <span
                className="font-bold text-white hidden sm:block"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em', fontSize: '18px', fontWeight: 800 }}
              >
                SECTION X SCOREBOARD
              </span>
              <span
                className="font-semibold text-white sm:hidden"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em', fontSize: '15px' }}
              >
                SEC X
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${isActive(link.href) ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Sports dropdown */}
              <div className="relative">
                <button
                  className={`nav-link flex items-center gap-1 ${pathname.startsWith('/sports') ? 'active' : ''}`}
                  onClick={() => setSportsMenuOpen(!sportsMenuOpen)}
                >
                  Sports
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {sportsMenuOpen && (
                  <div
                    className="absolute top-full left-0 mt-1 w-56 rounded-lg shadow-2xl z-50 py-1"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                  >
                    {['Spring', 'Fall', 'Winter'].map(season => {
                      const sports = ALL_SPORTS.filter(s => s.season === season)
                      return (
                        <div key={season}>
                          <div className="section-label px-3 py-2">{season}</div>
                          {sports.map(sport => (
                            <Link
                              key={sport.slug}
                              href={`/sports/${sport.slug}`}
                              className="block px-3 py-1.5 text-sm hover:bg-white/5 transition-colors"
                              style={{ color: 'var(--text-secondary)' }}
                              onClick={() => setSportsMenuOpen(false)}
                            >
                              {sport.name}
                            </Link>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/submit-score"
                className="hidden md:flex btn-primary text-xs px-3 py-1.5"
              >
                + Submit Score
              </Link>
              <button
                className="md:hidden p-2 rounded"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex flex-col gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-link ${isActive(link.href) ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="section-label mt-3 mb-1">Sports</div>
              {ALL_SPORTS.map(sport => (
                <Link
                  key={sport.slug}
                  href={`/sports/${sport.slug}`}
                  className="nav-link py-1"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {sport.name}
                </Link>
              ))}
              <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <Link
                  href="/submit-score"
                  className="btn-primary w-full text-sm py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  + Submit a Score
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
      <ScoreTicker />

      {/* Main */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }} className="mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div>
              <div className="section-label mb-3">Section X Scoreboard</div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                The home for Section X high school sports scores, schedules, and standings in Northern New York.
              </p>
            </div>
            <div>
              <div className="section-label mb-3">Sports</div>
              <div className="flex flex-col gap-1">
                {['Baseball', 'Softball', 'Boys Lacrosse', 'Football', 'Boys Basketball'].map(s => (
                  <Link
                    key={s}
                    href={`/sports/${s.toLowerCase().replace(/\s+/g, '-')}`}
                    className="text-xs hover:text-white transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <div className="section-label mb-3">Submit</div>
              <div className="flex flex-col gap-1">
                <Link href="/submit-score" className="text-xs hover:text-white transition-colors" style={{ color: 'var(--text-muted)' }}>Submit a Score</Link>
                <Link href="/submit-photo" className="text-xs hover:text-white transition-colors" style={{ color: 'var(--text-muted)' }}>Submit a Photo</Link>
                <Link href="/shoutout" className="text-xs hover:text-white transition-colors" style={{ color: 'var(--text-muted)' }}>Send a Shoutout</Link>
              </div>
            </div>
            <div>
              <div className="section-label mb-3">Info</div>
              <div className="flex flex-col gap-1">
                <Link href="/advertise" className="text-xs hover:text-white transition-colors" style={{ color: 'var(--text-muted)' }}>Advertise / Sponsor</Link>
                <Link href="/schools" className="text-xs hover:text-white transition-colors" style={{ color: 'var(--text-muted)' }}>All Schools</Link>
                <Link href="/admin" className="text-xs hover:text-white transition-colors" style={{ color: 'var(--text-muted)' }}>Admin</Link>
              </div>
            </div>
          </div>
          <div
            className="pt-6 flex flex-col md:flex-row items-center justify-between gap-2 text-xs"
            style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <span>© {new Date().getFullYear()} Section X Scoreboard. All rights reserved.</span>
            <span>Serving St. Lawrence & Franklin County high school sports.</span>
          </div>
        </div>
      </footer>
      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          background: 'rgba(5,8,15,0.97)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { href: '/', icon: '🏠', label: 'Home' },
            { href: '/scores', icon: '📅', label: 'Scores' },
            { href: '/standings', icon: '📊', label: 'Stand.' },
            { href: '/schools', icon: '🏫', label: 'Schools' },
            { href: '/submit-score', icon: '✏️', label: 'Submit' },
          ].map(item => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all"
                style={{ color: active ? '#60a5fa' : '#384d6b', minWidth: '52px' }}>
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-xs font-bold uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '9px' }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Bottom nav spacer on mobile */}
      <div className="h-16 md:hidden" />
    </div>
  )
}
