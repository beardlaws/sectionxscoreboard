// src/components/PlayoffSponsorWrapper.tsx
'use client'
import SponsorDisplay from './SponsorDisplay'
export default function PlayoffSponsorWrapper({ sponsor }: { sponsor: any }) {
  return <SponsorDisplay sponsor={sponsor} placement="playoff" pagePath="/playoffs" variant="banner" />
}
