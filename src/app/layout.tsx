// src/app/layout.tsx
import type { Metadata } from 'next'
import { Barlow_Condensed, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// TEMPORARY MIGRATION GUARD:
// A number of legacy admin/public routes still instantiate Supabase clients while
// we move their reads and writes to D1. Cloudflare preview intentionally does not
// carry the old public Supabase credentials, so static prerendering those legacy
// routes can fail during `next build` before the Worker is produced. Rendering
// dynamically keeps build-time code from executing those legacy data calls while
// we finish the backend cutover. Remove this once the remaining Supabase routes
// have been migrated.
export const dynamic = 'force-dynamic'

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-barlow-condensed',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.sectionxscoreboard.com'),
  title: {
    template: '%s | Section X Scoreboard',
    default: 'Section X Scoreboard',
  },
  description: 'Live scores, schedules, standings, and results for Section X high school sports in Northern New York.',
  openGraph: {
    type: 'website',
    siteName: 'Section X Scoreboard',
    title: 'Section X Scoreboard',
    description: 'Live scores, schedules, standings, and results for Section X high school sports in Northern New York.',
    url: 'https://www.sectionxscoreboard.com',
  },
  twitter: { card: 'summary_large_image', title: 'Section X Scoreboard' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${inter.variable} ${jetBrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
