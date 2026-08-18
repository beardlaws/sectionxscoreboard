// src/components/ScoresSponsorWrapper.tsx
'use client'
import SponsorDisplay from './SponsorDisplay'
export default function ScoresSponsorWrapper({ sponsor }: { sponsor: any }) {
  return <SponsorDisplay sponsor={sponsor} placement="scores" pagePath="/scores" variant="banner" />
}
