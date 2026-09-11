import type { Metadata } from 'next'
import LiveAudioPlayer from './LiveAudioPlayer'

export const metadata: Metadata = {
  title: 'Section X Live Audio',
  description: 'Listen live to Section X sports coverage from Section X Scoreboard.',
}

export const dynamic = 'force-dynamic'

export default function LiveAudioPage({ params }: { params: { id: string } }) {
  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <LiveAudioPlayer broadcastId={params.id} />
    </main>
  )
}
