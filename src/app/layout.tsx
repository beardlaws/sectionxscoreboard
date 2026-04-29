import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://sectionxscoreboard.com'),
  title: {
    default: 'Section X Scoreboard | North Country High School Sports Scores',
    template: '%s | Section X Scoreboard',
  },
  description: 'Live scores, schedules, standings, and results for Section X high school sports in Northern New York.',
  openGraph: {
    type: 'website',
    siteName: 'Section X Scoreboard',
    title: 'Section X Scoreboard | North Country High School Sports',
    description: 'Live scores, schedules, standings, and results for Section X high school sports in Northern New York.',
    url: 'https://sectionxscoreboard.com',
  },
  twitter: { card: 'summary_large_image', title: 'Section X Scoreboard' },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
