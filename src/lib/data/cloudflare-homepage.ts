import { sectionXDate, sectionXDateOffset } from '@/lib/sectionx-time'
import { getSportsRepository } from './runtime-sports-repository'

export async function getCloudflareHomepageCoreData() {
  const repo = getSportsRepository()
  const today = sectionXDate()
  const yesterday = sectionXDateOffset(-1)
  const tomorrow = sectionXDateOffset(1)
  const fourteenDaysOut = sectionXDateOffset(14)
  const sevenDaysAgo = sectionXDateOffset(-7)

  const [
    activeSeason,
    yesterdayGames,
    todayGames,
    tomorrowGames,
    upcomingGames,
    recentGames,
    featuredGame,
    schools,
  ] = await Promise.all([
    repo.getActiveSeason(),
    repo.getGamesByDate(yesterday),
    repo.getGamesByDate(today),
    repo.getGamesByDate(tomorrow),
    repo.getGamesBetween(today, fourteenDaysOut, 160),
    repo.getRecentFinals(sevenDaysAgo, 80),
    repo.getFeaturedGame(today),
    repo.getSchools(),
  ])

  return {
    source: 'cloudflare-d1',
    activeSeason,
    yesterdayGames,
    todayGames,
    tomorrowGames,
    upcomingGames,
    recentGames,
    featuredGame,
    schools,
    today,
  }
}
