// src/app/layout.tsx
import type { Metadata } from 'next'
import { Barlow_Condensed, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

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
