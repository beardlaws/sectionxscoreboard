// src/app/(public)/page.tsx
import type { Metadata } from 'next'
import PublicLayout from '@/components/layout/PublicLayout'
import HomePhotoExperience from '@/components/home/HomePhotoExperience'
import { getCloudflareHomepageCoreData } from '@/lib/data/cloudflare-homepage'

export const metadata: Metadata = { description: 'Section X scores, schedules, standings, results, schools, and stories for Northern New York high school sports.' }
export const dynamic = 'force-dynamic'

export default async function HomePage(){
 const core=await getCloudflareHomepageCoreData()
 const data={
  ...core,
  homepageSponsor:null,
  featuredSpotlight:null,
  featuredAthlete:null,
  allSpotlights:[],
  featuredPhoto:null,
  homepagePhotos:[],
  weeklyRecap:null,
 }
 return <PublicLayout><HomePhotoExperience {...data}/></PublicLayout>
}
