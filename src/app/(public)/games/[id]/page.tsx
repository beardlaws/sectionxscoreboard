// src/app/(public)/games/[id]/page.tsx
import { redirect } from 'next/navigation'

type PageProps = {
  params: { id: string }
}

export default function LegacyGamePage({ params }: PageProps) {
  redirect(`/game-center/${params.id}`)
}
