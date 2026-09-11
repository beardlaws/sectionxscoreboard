import type { Metadata } from 'next'
import BroadcastConsole from './BroadcastConsole'

export const metadata: Metadata = {
  title: 'Section X Live Broadcast Console',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function BroadcastPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <BroadcastConsole />
    </main>
  )
}
