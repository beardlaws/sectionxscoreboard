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

function normalizeDateOnly(value: unknown): string | null {
 if (value == null) return null
 const raw=String(value).trim()
 if (!raw) return null
 const isoPrefix=raw.match(/^(\d{4}-\d{2}-\d{2})/)
 if (isoPrefix) return isoPrefix[1]
 const parsed=new Date(raw)
 if (Number.isNaN(parsed.getTime())) return null
 return parsed.toISOString().slice(0,10)
}

function normalizeGame(game: any) {
 if (!game) return game
 return {
  ...game,
  game_date: normalizeDateOnly(game.game_date),
  rescheduled_date: normalizeDateOnly(game.rescheduled_date),
 }
}

function normalizeGames(value: unknown) {
 return safeArray<any>(value).map(normalizeGame)
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
  yesterdayGames:normalizeGames(core.yesterdayGames),
  todayGames:normalizeGames(core.todayGames),
  tomorrowGames:normalizeGames(core.tomorrowGames),
  upcomingGames:normalizeGames(core.upcomingGames),
  recentGames:normalizeGames(core.recentGames),
  featuredGame:normalizeGame(core.featuredGame),
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
