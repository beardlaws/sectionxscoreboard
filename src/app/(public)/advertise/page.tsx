// src/app/(public)/advertise/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import PublicLayout from '@/components/layout/PublicLayout'
import { SPONSOR_PLACEMENTS } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Advertise / Sponsor',
  description: 'Sponsor Section X Scoreboard and reach North Country sports families.',
}

export default function AdvertisePage() {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Hero */}
        <div
          className="rounded-2xl p-8 mb-10 text-center"
          style={{
            background: 'linear-gradient(135deg, #0d1528 0%, #1a2a4a 100%)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="text-5xl mb-4">🏆</div>
          <h1 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            Advertise on Section X Scoreboard
          </h1>
          <p className="text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
            Reach North Country sports families
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Put your business in front of local athletes, parents, coaches, and fans across St. Lawrence and Franklin Counties.
          </p>
          <a
            href="mailto:advertise@sectionxscoreboard.com"
            className="btn-primary text-base px-6 py-3"
          >
            Get in Touch →
          </a>
        </div>

        {/* Why advertise */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: '🎯', title: 'Targeted Audience', desc: 'Reach parents, athletes, and coaches actively engaged with local sports.' },
            { icon: '📱', title: 'Mobile-First', desc: 'Your brand on every phone at the game, in the car, at home.' },
            { icon: '📅', title: 'Season-Long', desc: "Sponsor tonight's scoreboard, a sport, a school page, or a season." },
          ].map(item => (
            <div key={item.title} className="card p-5 text-center">
              <div className="text-3xl mb-2">{item.icon}</div>
              <h3 className="font-semibold mb-1" style={{ fontFamily: 'var(--font-display)' }}>{item.title}</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Placements */}
        <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Sponsorship Placements</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {SPONSOR_PLACEMENTS.map(p => (
            <div key={p.key} className="card p-4 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-white font-bold"
                style={{ background: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: '12px' }}
              >
                SX
              </div>
              <div>
                <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{p.label}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.key === 'homepage' ? 'High visibility · All visitors' :
                   p.key === 'tonight_scores' ? "Tonight's scoreboard · Peak traffic" :
                   p.key === 'game_of_night' ? 'Featured game sponsor' :
                   'Targeted placement'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="card p-6 text-center">
          <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>Ready to Sponsor?</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Contact us to discuss placement options, pricing, and availability.
          </p>
          <a
            href="mailto:advertise@sectionxscoreboard.com"
            className="btn-primary"
          >
            Email: advertise@sectionxscoreboard.com
          </a>
        </div>
      </div>
    </PublicLayout>
  )
}
