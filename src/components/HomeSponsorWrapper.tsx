// src/components/HomeSponsorWrapper.tsx
'use client'
import SponsorDisplay from './SponsorDisplay'
export default function HomeSponsorWrapper({ sponsor }: { sponsor: any }) {
  return <SponsorDisplay sponsor={sponsor} placement="homepage" pagePath="/" variant="hero" />
}
