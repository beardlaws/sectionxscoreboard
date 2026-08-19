// src/lib/constants.ts
import type { SeasonType } from '@/types'

export const SPORT_SEASON_MAP: Record<string, SeasonType> = {
  Baseball: 'Spring',
  Softball: 'Spring',
  Lacrosse: 'Spring',
  'Boys Lacrosse': 'Spring',
  'Girls Lacrosse': 'Spring',
  Track: 'Spring',
  Golf: 'Spring',
  Football: 'Fall',
  Soccer: 'Fall',
  'Boys Soccer': 'Fall',
  'Girls Soccer': 'Fall',
  Volleyball: 'Fall',
  'Cross Country': 'Fall',
  Basketball: 'Winter',
  'Boys Basketball': 'Winter',
  'Girls Basketball': 'Winter',
  Hockey: 'Winter',
  Wrestling: 'Winter',
  Swimming: 'Fall',
  'Indoor Track': 'Winter',
}

export const HOMEPAGE_SPORTS: Record<SeasonType, string[]> = {
  Spring: [
    'Baseball',
    'Softball',
    'Boys Lacrosse',
    'Girls Lacrosse',
    'Track',
    'Golf',
  ],
  Fall: [
    'Football',
    'Boys Soccer',
    'Girls Soccer',
    'Volleyball',
    'Cross Country',
  ],
  Winter: [
    'Boys Basketball',
    'Girls Basketball',
    'Hockey',
    'Wrestling',
    'Swimming',
    'Indoor Track',
  ],
}

export const ALL_SPORTS = [
  {
    name: 'Baseball',
    gender: 'Boys',
    season: 'Spring' as SeasonType,
    slug: 'baseball',
  },
  {
    name: 'Softball',
    gender: 'Girls',
    season: 'Spring' as SeasonType,
    slug: 'softball',
  },
  {
    name: 'Boys Lacrosse',
    gender: 'Boys',
    season: 'Spring' as SeasonType,
    slug: 'boys-lacrosse',
  },
  {
    name: 'Girls Lacrosse',
    gender: 'Girls',
    season: 'Spring' as SeasonType,
    slug: 'girls-lacrosse',
  },
  {
    name: 'Track',
    gender: 'Both',
    season: 'Spring' as SeasonType,
    slug: 'track',
  },
  {
    name: 'Golf',
    gender: 'Boys',
    season: 'Spring' as SeasonType,
    slug: 'golf',
  },
  {
    name: 'Football',
    gender: 'Boys',
    season: 'Fall' as SeasonType,
    slug: 'football',
  },
  {
    name: 'Boys Soccer',
    gender: 'Boys',
    season: 'Fall' as SeasonType,
    slug: 'boys-soccer',
  },
  {
    name: 'Girls Soccer',
    gender: 'Girls',
    season: 'Fall' as SeasonType,
    slug: 'girls-soccer',
  },
  {
    name: 'Volleyball',
    gender: 'Girls',
    season: 'Fall' as SeasonType,
    slug: 'volleyball',
  },
  {
    name: 'Cross Country',
    gender: 'Both',
    season: 'Fall' as SeasonType,
    slug: 'cross-country',
  },
  {
    name: 'Boys Basketball',
    gender: 'Boys',
    season: 'Winter' as SeasonType,
    slug: 'boys-basketball',
  },
  {
    name: 'Girls Basketball',
    gender: 'Girls',
    season: 'Winter' as SeasonType,
    slug: 'girls-basketball',
  },
  {
    name: 'Hockey',
    gender: 'Both',
    season: 'Winter' as SeasonType,
    slug: 'hockey',
  },
  {
    name: 'Wrestling',
    gender: 'Both',
    season: 'Winter' as SeasonType,
    slug: 'wrestling',
  },
  {
    name: 'Swimming',
    gender: 'Both',
    season: 'Winter' as SeasonType,
    slug: 'swimming',
  },
  {
    name: 'Indoor Track',
    gender: 'Both',
    season: 'Winter' as SeasonType,
    slug: 'indoor-track',
  },
]

export const SCHOOL_ALIASES: Record<string, string> = {
  // Ogdensburg
  OFA: 'Ogdensburg Free Academy',
  Ogdensburg: 'Ogdensburg Free Academy',

  // Madrid-Waddington
  MW: 'Madrid-Waddington Central',
  'Madrid-Wadd.': 'Madrid-Waddington Central',
  'Madrid-Wadd': 'Madrid-Waddington Central',

  // St. Lawrence Central
  SLC: 'St Lawrence Central School',
  'St. Lawrence': 'St Lawrence Central School',
  'St. Lawrence Central': 'St Lawrence Central School',
  'St. Lawrence Central School': 'St Lawrence Central School',
  'St Lawrence Central': 'St Lawrence Central School',

  // Norwood-Norfolk
  NN: 'Norwood-Norfolk Central',

  // Hermon-DeKalb
  HD: 'Hermon-Dekalb Central School',
  'Hermon-DeKalb': 'Hermon-Dekalb Central School',
  'Hermon DeKalb': 'Hermon-Dekalb Central School',

  // Brushton-Moira
  BM: 'Brushton-Moira Central School',
  'Brushton-Moira': 'Brushton-Moira Central School',

  // Parishville-Hopkinton
  PH: 'Parishville-Hopkinton Central School',
  'Parishville-Hopkinton': 'Parishville-Hopkinton Central School',

  // Salmon River
  SR: 'Salmon River Central School',
  'Salmon River': 'Salmon River Central School',

  // St. Regis Falls
  SRF: 'St Regis Falls Central School',
  'St. Regis Falls': 'St Regis Falls Central School',
  'St. Regis': 'St Regis Falls Central School',
  'St Regis': 'St Regis Falls Central School',
  'Regis Falls': 'St Regis Falls Central School',

  // Tupper Lake
  TL: 'Tupper Lake Central School',
  'Tupper Lake': 'Tupper Lake Central School',

  // Gouverneur
  GOUV: 'Gouverneur Central School',
  Gouverneur: 'Gouverneur Central School',

  // Canton
  CANTON: 'Canton Central School',
  Canton: 'Canton Central School',

  // Malone / Franklin Academy
  Malone: 'Malone Central School',
  'Malone Central': 'Malone Central School',
  'Franklin Academy': 'Malone Central School',
  'Franklin Academy - Malone CSD': 'Malone Central School',
  'Franklin Academy - Malone': 'Malone Central School',
  'Franklin Academy - MCSD': 'Malone Central School',
  'Franklin Academy Malone CSD': 'Malone Central School',

  // Massena
  Massena: 'Massena Central School',

  // Potsdam
  Potsdam: 'Potsdam Central School',

  // Chateaugay
  CHAT: 'Chateaugay Central School',
  Chateaugay: 'Chateaugay Central School',

  // Clifton-Fine
  CF: 'Clifton-Fine Central School',
  'Clifton-Fine': 'Clifton-Fine Central School',

  // Colton-Pierrepont
  CP: 'Colton-Pierrepont Central School',
  'Colton-Pierrepont': 'Colton-Pierrepont Central School',

  // Edwards-Knox
  EK: 'Edwards-Knox Central School',
  'Edwards-Knox': 'Edwards-Knox Central School',

  // Hammond
  HAMMOND: 'Hammond Central School',
  Hammond: 'Hammond Central School',

  // Harrisville
  Harrisville: 'Harrisville Central School',

  // Heuvelton
  HCS: 'Heuvelton Central School',
  Heuvelton: 'Heuvelton Central School',

  // Lisbon
  LCS: 'Lisbon Central School',
  Lisbon: 'Lisbon Central School',

  // Morristown
  Morristown: 'Morristown Central School',
}

export const SHOUTOUT_TYPES = [
  'Player of the Game',
  'Big Play',
  'Clutch Moment',
  'Milestone',
  'Senior Night',
  'First Varsity Hit',
  'First Varsity Goal',
  'No-Hitter',
  'Hat Trick',
  'Walk-Off Win',
]

export const SPONSOR_PLACEMENTS = [
  { key: 'homepage', label: 'Homepage' },
  { key: 'tonight_scores', label: "Tonight's Scores" },
  { key: 'spring_scoreboard', label: 'Spring Scoreboard' },
  { key: 'baseball', label: 'Baseball' },
  { key: 'softball', label: 'Softball' },
  { key: 'boys_lacrosse', label: "Boys' Lacrosse" },
  { key: 'girls_lacrosse', label: "Girls' Lacrosse" },
  { key: 'school_page', label: 'School Page' },
  { key: 'game_of_night', label: 'Game of the Night' },
  { key: 'photo_of_week', label: 'Photo of the Week' },
  { key: 'weekly_recap', label: 'Weekly Recap' },
]

export function getSeasonType(sportName: string): SeasonType {
  const baseSport = sportName.replace(/^(Boys |Girls )/, '')

  return (
    SPORT_SEASON_MAP[sportName] ||
    SPORT_SEASON_MAP[baseSport] ||
    'Spring'
  )
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function formatScore(score: number | null): string {
  return score !== null ? String(score) : '-'
}

export function isCloseGame(
  homeScore: number | null,
  awayScore: number | null
): boolean {
  if (
    homeScore === null ||
    awayScore === null
  ) {
    return false
  }

  return Math.abs(
    homeScore - awayScore
  ) <= 1
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'Final':
      return 'badge-final'

    case 'Live':
      return 'badge-live'

    case 'Scheduled':
      return 'badge-scheduled'

    case 'Postponed':
      return 'badge-postponed'

    case 'Canceled':
      return 'badge-canceled'

    default:
      return 'badge-scheduled'
  }
}

export const STATUS_COLORS: Record<string, string> = {
  Final:
    'bg-emerald-900/40 text-emerald-400 border border-emerald-800',

  Live:
    'bg-red-900/40 text-red-400 border border-red-800 animate-pulse',

  Scheduled:
    'bg-blue-900/40 text-blue-400 border border-blue-800',

  Postponed:
    'bg-amber-900/40 text-amber-400 border border-amber-800',

  Canceled:
    'bg-slate-800/60 text-slate-500 border border-slate-700',
}

export const SECTION_X_SCHOOLS = [
  'Brushton-Moira Central School',
  'Canton Central School',
  'Chateaugay Central School',
  'Clifton-Fine Central School',
  'Colton-Pierrepont Central School',
  'Edwards-Knox Central School',
  'Gouverneur Central School',
  'Hammond Central School',
  'Harrisville Central School',
  'Hermon-Dekalb Central School',
  'Heuvelton Central School',
  'Lisbon Central School',
  'Madrid-Waddington Central',
  'Malone Central School',
  'Massena Central School',
  'Morristown Central School',
  'Norwood-Norfolk Central',
  'Ogdensburg Free Academy',
  'Parishville-Hopkinton Central School',
  'Potsdam Central School',
  'Salmon River Central School',
  'St Lawrence Central School',
  'St Regis Falls Central School',
  'Tupper Lake Central School',
]
