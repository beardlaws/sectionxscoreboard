// src/components/SchoolSponsorWrapper.tsx
'use client'
import SponsorDisplay from './SponsorDisplay'
export default function SchoolSponsorWrapper({ sponsor, schoolSlug }: { sponsor: any; schoolSlug: string }) {
  return <SponsorDisplay sponsor={sponsor} placement="school" pagePath={`/schools/${schoolSlug}`} variant="card" />
}
