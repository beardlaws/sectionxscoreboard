// src/components/SportSponsorWrapper.tsx
'use client'
import SponsorDisplay from './SponsorDisplay'
export default function SportSponsorWrapper({ sponsor, sportSlug }: { sponsor: any; sportSlug: string }) {
  return <SponsorDisplay sponsor={sponsor} placement="sport" pagePath={`/sports/${sportSlug}`} variant="banner" />
}
