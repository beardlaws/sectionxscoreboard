// src/app/(public)/page.tsx
import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'
import HomePhotoExperience from '@/components/home/HomePhotoExperience'
import { getCloudflareHomepageCoreData } from '@/lib/data/cloudflare-homepage'
import { getPublicContentRepository } from '@/lib/data/runtime-public-content-repository'

export const metadata: Metadata = { description: 'Section X scores, schedules, standings, results, schools, and stories for Northern New York high school sports.' }
export const dynamic = 'force-dynamic'

function safeArray<T = any>(value: unknown): T[] {
 return Array.isArray(value) ? value : []
}

export default async function HomePage(){
 const core=await getCloudflareHomepageCoreData()
 const content=getPublicContentRepository()
 const [homepageSponsor,featuredSpotlight,featuredAthlete,allSpotlightsRaw,homepagePhotosRaw,weeklyRecap]=await Promise.all([
  content.getHomepageSponsor(core.today),
  content.getFeaturedSpotlight(),
  content.getFeaturedAthlete(),
  content.getSpotlights(8),
  content.getHomepagePhotos(12),
  content.getLatestWeeklyRecap(),
 ])

 const homepagePhotos=safeArray(homepagePhotosRaw)
 const data={
  ...core,
  yesterdayGames:safeArray(core.yesterdayGames),
  todayGames:safeArray(core.todayGames),
  tomorrowGames:safeArray(core.tomorrowGames),
  upcomingGames:safeArray(core.upcomingGames),
  recentGames:safeArray(core.recentGames),
  schools:safeArray(core.schools),
  homepageSponsor,
  featuredSpotlight,
  featuredAthlete,
  allSpotlights:safeArray(allSpotlightsRaw),
  featuredPhoto:homepagePhotos[0]||null,
  homepagePhotos,
  weeklyRecap,
 }
 return <PublicLayout><HomePhotoExperience {...data}/></PublicLayout>
}
