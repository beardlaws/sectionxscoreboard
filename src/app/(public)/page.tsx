// src/app/(public)/page.tsx
import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'
import HomePhotoExperience from '@/components/home/HomePhotoExperience'
import { getCloudflareHomepageCoreData } from '@/lib/data/cloudflare-homepage'
import { getPublicContentRepository } from '@/lib/data/runtime-public-content-repository'

export const metadata: Metadata = { description: 'Section X scores, schedules, standings, results, schools, and stories for Northern New York high school sports.' }
export const dynamic = 'force-dynamic'

export default async function HomePage(){
 const core=await getCloudflareHomepageCoreData()
 const content=getPublicContentRepository()
 const [homepageSponsor,featuredSpotlight,featuredAthlete,allSpotlights,homepagePhotos,weeklyRecap]=await Promise.all([
  content.getHomepageSponsor(core.today),
  content.getFeaturedSpotlight(),
  content.getFeaturedAthlete(),
  content.getSpotlights(8),
  content.getHomepagePhotos(12),
  content.getLatestWeeklyRecap(),
 ])
 const data={
  ...core,
  homepageSponsor,
  featuredSpotlight,
  featuredAthlete,
  allSpotlights,
  featuredPhoto:homepagePhotos[0]||null,
  homepagePhotos,
  weeklyRecap,
 }
 return <PublicLayout><HomePhotoExperience {...data}/></PublicLayout>
}
