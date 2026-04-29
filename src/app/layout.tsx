// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://sectionxscoreboard.com'),
  title: {
    default: 'Section X Scoreboard | North Country High School Sports Scores',
    template: '%s | Section X Scoreboard',
  },
  description:
    'Live scores, schedules, standings, and results for Section X high school sports in Northern New York. Baseball, softball, lacrosse, football, basketball, hockey, and more.',
  keywords: [
    'Section X scores',
    'Section X sports scores',
    'Section X baseball scores',
    'Section X softball scores',
    'Section X lacrosse scores',
    'North Country sports scores',
    'Northern NY high school sports',
    'St. Lawrence County high school sports',
    'Franklin County high school sports',
    'Ogdensburg sports scores',
    'Massena sports scores',
    'Canton sports scores',
    'Potsdam sports scores',
    'Gouverneur sports scores',
    'Malone sports scores',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Section X Scoreboard',
    title: 'Section X Scoreboard | North Country High School Sports',
    description: 'Live scores, schedules, standings, and results for Section X high school sports in Northern New York.',
    url: 'https://sectionxscoreboard.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Section X Scoreboard',
    description: 'Live scores & results for Section X high school sports.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
