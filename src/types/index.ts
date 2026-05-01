// src/types/index.ts

export type SeasonType = 'Spring' | 'Fall' | 'Winter'
export type GameStatus = 'Scheduled' | 'Live' | 'Final' | 'Postponed' | 'Canceled'
export type VerificationStatus = 'Reported' | 'Verified' | 'Official'
export type ImportSource = 'manual' | 'bulk_paste' | 'csv' | 'arbiter' | 'public_submission'
export type ImportConfidence = 'High' | 'Medium' | 'Low'
export type SponsorPlacement = 
  | 'homepage' | 'tonight_scores' | 'spring_scoreboard' | 'baseball' 
  | 'softball' | 'boys_lacrosse' | 'girls_lacrosse' | 'school_page' 
  | 'game_of_night' | 'photo_of_week' | 'weekly_recap'

export interface School {
  id: string
  school_name: string
  mascot: string
  city: string
  county: string
  primary_color: string
  secondary_color: string
  alias: string
  slug: string
  active: boolean
  created_at: string
}

export interface Sport {
  id: string
  sport_name: string
  gender: string
  season_type: SeasonType
  homepage_priority: number
  active_public: boolean
  slug: string
}

export interface Team {
  id: string
  school_id: string
  sport_id: string
  team_name: string
  slug: string
  level: string
  active: boolean
  created_at: string
  school?: School
  sport?: Sport
}

export interface Season {
  id: string
  name: string
  year: number
  season_type: SeasonType
  is_active: boolean
  start_date: string | null
  end_date: string | null
  created_at: string
}

export interface TeamSeason {
  id: string
  team_id: string
  season_id: string
  class: string
  division: string
  active_for_season: boolean
  display_team_name: string | null
  is_coop: boolean
  coop_schools: string | null
  notes: string | null
  team?: Team
  season?: Season
}

export interface ExternalOpponent {
  id: string
  name: string
  slug: string
  city: string | null
  state: string | null
  is_section_x: boolean
  created_at: string
}

export interface Game {
  id: string
  season_id: string
  sport_id: string
  home_team_id: string | null
  away_team_id: string | null
  external_home_opponent_id: string | null
  external_away_opponent_id: string | null
  game_date: string
  game_time: string | null
  location: string | null
  home_score: number | null
  away_score: number | null
  status: GameStatus
  verification_status: VerificationStatus
  source: ImportSource
  notes: string | null
  featured: boolean
  game_of_the_night: boolean
  rescheduled_date: string | null
  doubleheader_group_id: string | null
  game_number: number | null
  event_name: string | null
  neutral_site: boolean
  import_id: string | null
  parser_confidence: ImportConfidence | null
  recap: string | null
  recap_author: string | null
  created_at: string
  updated_at: string
  // Joined
  home_team?: Team & { school?: School }
  away_team?: Team & { school?: School }
  external_home?: ExternalOpponent
  external_away?: ExternalOpponent
  sport?: Sport
  season?: Season
}

export interface GameWithTeams extends Game {
  home_team: (Team & { school: School }) | null
  away_team: (Team & { school: School }) | null
  external_home: ExternalOpponent | null
  external_away: ExternalOpponent | null
  sport: Sport
}

export interface Submission {
  id: string
  submitter_name: string
  submitter_email: string
  game_date: string
  home_team_name: string
  away_team_name: string
  home_score: number
  away_score: number
  sport_name: string
  notes: string | null
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface Photo {
  id: string
  submitter_name: string
  submitter_email: string
  photographer_credit_name: string
  school_id: string | null
  team_id: string | null
  game_id: string | null
  sport_id: string | null
  caption: string | null
  photo_url: string
  permission_confirmed: boolean
  approved: boolean
  featured: boolean
  created_at: string
  school?: School
  team?: Team
}

export interface Shoutout {
  id: string
  submitter_name: string
  submitter_email: string
  school_id: string | null
  team_id: string | null
  game_id: string | null
  athlete_name: string
  shoutout_type: string
  description: string
  approved: boolean
  featured: boolean
  created_at: string
}

export interface Sponsor {
  id: string
  business_name: string
  contact_name?: string | null
  contact_email?: string | null
  logo_url?: string | null
  tagline?: string | null
  website_url?: string | null
  placement: string
  active: boolean
  start_date?: string | null
  end_date?: string | null
  created_at: string
}

export interface CorrectionRequest {
  id: string
  game_id: string
  submitter_name: string
  submitter_email: string
  correction_text: string
  status: 'open' | 'pending' | 'resolved' | 'dismissed'
  created_at: string
}

export interface ImportLog {
  id: string
  import_type: string
  raw_text: string | null
  file_name: string | null
  parsed_rows: number
  approved_rows: number
  rejected_rows: number
  status: 'pending' | 'reviewing' | 'complete'
  created_by: string | null
  created_at: string
}

export interface SiteSettings {
  id: string
  key: string
  value: string
  updated_at: string
}

// Import parsing types
export interface ParsedGameRow {
  id: string // temp client id
  raw: string
  game_date: string | null
  home_team_name: string | null
  away_team_name: string | null
  home_score: number | null
  away_score: number | null
  status: GameStatus
  game_time: string | null
  rescheduled_date: string | null
  game_number: number | null
  neutral_site: boolean
  event_name: string | null
  confidence: ImportConfidence
  confidence_notes: string[]
  home_team_id: string | null
  away_team_id: string | null
  home_team_match: string | null
  away_team_match: string | null
  duplicate_warning: boolean
  approved: boolean
  error: string | null
  sport_id?: string | null
  external_home_name?: string | null
  external_away_name?: string | null
}

// Standings
export interface StandingsRow {
  team_id: string
  team_name: string
  school_name: string
  school_slug: string
  team_slug: string
  slug?: string
  wins: number
  losses: number
  ties: number
  league_wins: number
  league_losses: number
  league_ties: number
  points_for: number
  points_against: number
  win_pct: number
  league_win_pct: number
  btm: number
  class: string
  division: string
  primary_color?: string
}
