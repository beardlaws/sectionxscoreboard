import { Suspense } from 'react'
import FollowingClient from './FollowingClient'

export const dynamic = 'force-dynamic'

export default function FollowingPage() {
  return <Suspense fallback={<div className="max-w-3xl mx-auto px-4 py-8 text-sm text-white/50">Loading follow preferences…</div>}><FollowingClient /></Suspense>
}
