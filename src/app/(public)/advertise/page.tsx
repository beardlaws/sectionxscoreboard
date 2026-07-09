// src/app/(public)/advertise/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PublicLayout from '@/components/layout/PublicLayout'
import { Check } from 'lucide-react'

const supabase = createClient()

const PACKAGES = [
  {
    id: 'homepage',
    name: 'Presenting Sponsor',
    price: '$400/month',
    highlight: true,
    badge: '⭐ Most Popular',
    description: 'Your business is the face of Section X Scoreboard. Every visitor, every night.',
    features: [
      'Logo + tagline on homepage hero',
      '"Tonight\'s Scores Presented By" placement',
      'Link to your website',
      'Seen by 500–2,000+ visitors on game nights',
      'One sponsor at a time — exclusive placement',
    ],
    icon: '🏠',
  },
  {
    id: 'school',
    name: 'School Sponsor',
    price: '$100/month',
    highlight: false,
    badge: '24 available',
    description: 'Own coverage of your hometown school. Parents see your business every time they check scores.',
    features: [
      'Logo + tagline on school page',
      'Shown on every game result for that school',
      'Hyper-local targeting — fans of that school only',
      'Perfect for local businesses near each school',
      '24 schools available',
    ],
    icon: '🏫',
  },
  {
    id: 'sport',
    name: 'Sport Sponsor',
    price: '$150/month',
    highlight: false,
    badge: 'Per season',
    description: 'Own an entire sport for a season. Great for businesses that serve athletes.',
    features: [
      'Logo on sport page and standings',
      'Shown on every game in that sport',
      '"Coverage brought to you by" placement',
      'Football, basketball, baseball, softball + more',
      'Seasonal commitment — 2-3 months',
    ],
    icon: '⚽',
  },
  {
    id: 'playoff',
    name: 'Playoff Bracket',
    price: '$250/bracket',
    highlight: false,
    badge: 'High traffic',
    description: 'Playoffs drive the biggest audience of the year. Be there for the biggest moments.',
    features: [
      'Logo on bracket page',
      'Shown during 2-3 weeks of playoffs',
      'Peak traffic period — parents refresh constantly',
      'Class A, B, C, D brackets available',
      'Per-bracket pricing',
    ],
    icon: '🏆',
  },
]

const STATS = [
  { label: 'Schools Covered', value: '24', icon: '🏫' },
  { label: 'Sports Covered', value: '10+', icon: '⚽' },
  { label: 'Game Nights/Year', value: '100+', icon: '📅' },
  { label: 'Counties Served', value: '2', icon: '📍' },
]

const TESTIMONIAL_SPORTS = ['Football', 'Basketball', 'Baseball', 'Softball', 'Lacrosse', 'Soccer', 'Volleyball', 'Hockey']

export default function AdvertisePage() {
  const [form, setForm] = useState({
    business_name: '', contact_name: '', email: '', phone: '',
    package_interest: '', school_interest: '', sport_interest: '', message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!form.business_name || !form.contact_name || !form.email) {
      setError('Please fill in business name, contact name, and email.'); return
    }
    setLoading(true); setError('')
    const { error: dbErr } = await supabase.from('advertise_inquiries').insert(form)
    if (dbErr) { setError('Something went wrong. Email us directly at sectionxscoreboard@gmail.com'); setLoading(false); return }
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Hero */}
        <div className="rounded-2xl p-8 mb-10 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(8,12,20,0.95) 60%)', border: '1px solid rgba(37,99,235,0.3)' }}>
          <div className="relative">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black mb-4 uppercase tracking-widest"
              style={{ background: 'rgba(37,99,235,0.2)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.3)', fontFamily: 'var(--font-display)' }}>
              Advertise with Section X Scoreboard
            </span>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}>
              Reach Every North Country Sports Family
            </h1>
            <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-6">
              Section X Scoreboard is where parents, athletes, coaches, and fans check scores across St. Lawrence and Franklin County. Put your business in front of them every game night.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {STATS.map(stat => (
                <div key={stat.label} className="rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-2xl mb-1">{stat.icon}</p>
                  <p className="text-xl font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Why sponsor */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-white mb-6 text-center" style={{ fontFamily: 'var(--font-display)' }}>
            Why Sponsor Section X Scoreboard?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: '🎯',
                title: 'Hyper-Local Targeting',
                body: 'Your ad reaches exactly the community you serve — North Country families, parents, athletes, and fans. No wasted impressions on people who live 300 miles away.',
              },
              {
                icon: '📱',
                title: 'Mobile-First Audience',
                body: 'Parents check scores on their phones from bleachers, living rooms, and cars. Your business appears where they\'re already looking, at the exact moment they\'re most engaged.',
              },
              {
                icon: '🏆',
                title: 'Community Association',
                body: 'Sponsoring high school sports is one of the most respected forms of community support. Your business becomes part of North Country athletic culture.',
              },
            ].map(item => (
              <div key={item.title} className="rounded-2xl p-5 border border-white/8"
                style={{ background: 'rgba(8,12,20,0.7)' }}>
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <h3 className="font-black text-white text-base mb-2" style={{ fontFamily: 'var(--font-display)' }}>{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Packages */}
        <div className="mb-10">
          <h2 className="text-2xl font-black text-white mb-2 text-center" style={{ fontFamily: 'var(--font-display)' }}>
            Sponsorship Packages
          </h2>
          <p className="text-slate-400 text-sm text-center mb-6">All packages include your logo, business name, tagline, and link to your website.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PACKAGES.map(pkg => (
              <div key={pkg.id}
                className="rounded-2xl p-5 border transition-all hover:-translate-y-0.5"
                style={{
                  background: pkg.highlight ? 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(8,12,20,0.95))' : 'rgba(8,12,20,0.7)',
                  border: pkg.highlight ? '1px solid rgba(37,99,235,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: pkg.highlight ? '0 0 30px rgba(37,99,235,0.15)' : 'none',
                }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{pkg.icon}</span>
                      <h3 className="font-black text-white text-lg" style={{ fontFamily: 'var(--font-display)' }}>{pkg.name}</h3>
                    </div>
                    <p className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: pkg.highlight ? '#60a5fa' : '#4ade80' }}>
                      {pkg.price}
                    </p>
                  </div>
                  <span className="text-xs font-black px-2 py-1 rounded-full flex-shrink-0"
                    style={{
                      background: pkg.highlight ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.06)',
                      color: pkg.highlight ? '#60a5fa' : '#94a3b8',
                      fontFamily: 'var(--font-display)',
                    }}>
                    {pkg.badge}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mb-4">{pkg.description}</p>
                <div className="space-y-1.5">
                  {pkg.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-300">{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setForm(p => ({ ...p, package_interest: pkg.name }))
                    document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="mt-4 w-full py-2 rounded-xl text-sm font-black transition-all hover:brightness-110"
                  style={{
                    background: pkg.highlight ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'rgba(255,255,255,0.06)',
                    color: pkg.highlight ? 'white' : '#94a3b8',
                    fontFamily: 'var(--font-display)',
                    border: pkg.highlight ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  }}>
                  Get Started →
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sports coverage */}
        <div className="rounded-2xl p-6 mb-10 border border-white/8" style={{ background: 'rgba(8,12,20,0.5)' }}>
          <h2 className="text-xl font-black text-white mb-4 text-center" style={{ fontFamily: 'var(--font-display)' }}>
            Sports We Cover
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {TESTIMONIAL_SPORTS.map(sport => (
              <span key={sport} className="text-sm px-3 py-1.5 rounded-full font-bold"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
                {sport}
              </span>
            ))}
            <span className="text-sm px-3 py-1.5 rounded-full font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)' }}>
              + More
            </span>
          </div>
          <p className="text-slate-500 text-sm text-center mt-4">
            Fall sports start August 2026 · Basketball season December 2026
          </p>
        </div>

        {/* Contact form */}
        <div id="contact-form" className="card p-6">
          <h2 className="text-2xl font-black text-white mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            Get Started Today
          </h2>
          <p className="text-slate-400 text-sm mb-5">Fill out the form and we'll get back to you within 24 hours with a custom proposal.</p>

          {submitted ? (
            <div className="text-center py-8">
              <span className="text-5xl block mb-4">🎉</span>
              <p className="text-xl font-black text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Inquiry Received!
              </p>
              <p className="text-slate-400">We'll reach out within 24 hours to discuss your sponsorship.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Business Name *</label>
                  <input className="input w-full" placeholder="Your business name"
                    value={form.business_name}
                    onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Your Name *</label>
                  <input className="input w-full" placeholder="First Last"
                    value={form.contact_name}
                    onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input type="email" className="input w-full" placeholder="you@business.com"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Phone (optional)</label>
                  <input className="input w-full" placeholder="555-1234"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Package Interest</label>
                <select className="input w-full" value={form.package_interest}
                  onChange={e => setForm(p => ({ ...p, package_interest: e.target.value }))}>
                  <option value="">Not sure yet — let's talk</option>
                  {PACKAGES.map(pkg => (
                    <option key={pkg.id} value={pkg.name}>{pkg.name} — {pkg.price}</option>
                  ))}
                </select>
              </div>

              {form.package_interest === 'School Sponsor' && (
                <div>
                  <label className="label">Which School?</label>
                  <input className="input w-full" placeholder="e.g. Canton Central School"
                    value={form.school_interest}
                    onChange={e => setForm(p => ({ ...p, school_interest: e.target.value }))} />
                </div>
              )}

              {form.package_interest === 'Sport Sponsor' && (
                <div>
                  <label className="label">Which Sport?</label>
                  <select className="input w-full" value={form.sport_interest}
                    onChange={e => setForm(p => ({ ...p, sport_interest: e.target.value }))}>
                    <option value="">Select sport...</option>
                    {TESTIMONIAL_SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="label">Message (optional)</label>
                <textarea className="input w-full h-24 resize-none"
                  placeholder="Tell us about your business, budget, or any questions you have..."
                  value={form.message}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button onClick={submit} disabled={loading}
                className="btn-primary w-full py-3 text-base">
                {loading ? 'Sending...' : 'Send Inquiry →'}
              </button>

              <p className="text-xs text-slate-600 text-center">
                No obligation. We'll reach out within 24 hours with availability and pricing details.
              </p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}
