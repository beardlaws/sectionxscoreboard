PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  school_name TEXT NOT NULL,
  mascot TEXT,
  city TEXT,
  county TEXT,
  primary_color TEXT DEFAULT '#1e3a5f',
  secondary_color TEXT DEFAULT '#ffffff',
  alias TEXT,
  slug TEXT UNIQUE NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug);
CREATE INDEX IF NOT EXISTS idx_schools_county ON schools(county);

CREATE TABLE IF NOT EXISTS sports (
  id TEXT PRIMARY KEY,
  sport_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'Both',
  season_type TEXT NOT NULL,
  homepage_priority INTEGER DEFAULT 99,
  active_public INTEGER DEFAULT 1,
  slug TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sports_slug ON sports(slug);
CREATE INDEX IF NOT EXISTS idx_sports_season_type ON sports(season_type);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  school_id TEXT REFERENCES schools(id) ON DELETE CASCADE,
  sport_id TEXT REFERENCES sports(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  level TEXT DEFAULT 'Varsity',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(school_id, sport_id, level)
);
CREATE INDEX IF NOT EXISTS idx_teams_school ON teams(school_id);
CREATE INDEX IF NOT EXISTS idx_teams_sport ON teams(sport_id);
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  season_type TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active);
CREATE INDEX IF NOT EXISTS idx_seasons_year_type ON seasons(year, season_type);

CREATE TABLE IF NOT EXISTS team_seasons (
  id TEXT PRIMARY KEY,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  season_id TEXT REFERENCES seasons(id) ON DELETE CASCADE,
  class TEXT,
  division TEXT,
  active_for_season INTEGER DEFAULT 1,
  display_team_name TEXT,
  is_coop INTEGER DEFAULT 0,
  coop_schools TEXT,
  notes TEXT,
  UNIQUE(team_id, season_id)
);
CREATE INDEX IF NOT EXISTS idx_team_seasons_team ON team_seasons(team_id);
CREATE INDEX IF NOT EXISTS idx_team_seasons_season ON team_seasons(season_id);

CREATE TABLE IF NOT EXISTS external_opponents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  city TEXT,
  state TEXT DEFAULT 'NY',
  section TEXT,
  is_section_x INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS import_logs (
  id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL,
  raw_input TEXT,
  rows_parsed INTEGER DEFAULT 0,
  rows_approved INTEGER DEFAULT 0,
  rows_rejected INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  imported_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  season_id TEXT REFERENCES seasons(id),
  sport_id TEXT REFERENCES sports(id),
  home_team_id TEXT REFERENCES teams(id),
  away_team_id TEXT REFERENCES teams(id),
  external_home_opponent_id TEXT REFERENCES external_opponents(id),
  external_away_opponent_id TEXT REFERENCES external_opponents(id),
  game_date TEXT NOT NULL,
  game_time TEXT,
  location TEXT,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  verification_status TEXT NOT NULL DEFAULT 'Reported',
  source TEXT,
  notes TEXT,
  featured INTEGER DEFAULT 0,
  game_of_the_night INTEGER DEFAULT 0,
  rescheduled_date TEXT,
  doubleheader_group_id TEXT,
  game_number INTEGER,
  event_name TEXT,
  neutral_site INTEGER DEFAULT 0,
  import_id TEXT REFERENCES import_logs(id),
  parser_confidence TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_games_season ON games(season_id);
CREATE INDEX IF NOT EXISTS idx_games_sport ON games(sport_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_home_team ON games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team ON games(away_team_id);
CREATE INDEX IF NOT EXISTS idx_games_featured ON games(featured) WHERE featured = 1;
CREATE INDEX IF NOT EXISTS idx_games_gotn ON games(game_of_the_night) WHERE game_of_the_night = 1;

CREATE TRIGGER IF NOT EXISTS games_updated_at
AFTER UPDATE ON games
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE games SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  submitter_name TEXT NOT NULL,
  submitter_email TEXT,
  sport_name TEXT,
  home_team_name TEXT,
  away_team_name TEXT,
  home_score INTEGER,
  away_score INTEGER,
  game_date TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  submitter_name TEXT NOT NULL,
  submitter_email TEXT,
  photographer_credit_name TEXT,
  school_id TEXT REFERENCES schools(id),
  team_id TEXT REFERENCES teams(id),
  game_id TEXT REFERENCES games(id),
  sport_id TEXT REFERENCES sports(id),
  caption TEXT,
  photo_url TEXT NOT NULL,
  permission_confirmed INTEGER DEFAULT 0,
  approved INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_photos_approved ON photos(approved);
CREATE INDEX IF NOT EXISTS idx_photos_featured ON photos(featured) WHERE featured = 1;
CREATE INDEX IF NOT EXISTS idx_photos_school ON photos(school_id);
CREATE INDEX IF NOT EXISTS idx_photos_sport ON photos(sport_id);

CREATE TABLE IF NOT EXISTS shoutouts (
  id TEXT PRIMARY KEY,
  submitter_name TEXT NOT NULL,
  submitter_email TEXT,
  school_id TEXT REFERENCES schools(id),
  team_id TEXT REFERENCES teams(id),
  game_id TEXT REFERENCES games(id),
  athlete_name TEXT,
  shoutout_type TEXT NOT NULL,
  description TEXT NOT NULL,
  approved INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shoutouts_approved ON shoutouts(approved);

CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  website_url TEXT,
  logo_url TEXT,
  tagline TEXT,
  placement TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sponsors_placement ON sponsors(placement);
CREATE INDEX IF NOT EXISTS idx_sponsors_active ON sponsors(active);

CREATE TABLE IF NOT EXISTS correction_requests (
  id TEXT PRIMARY KEY,
  game_id TEXT REFERENCES games(id),
  submitter_name TEXT NOT NULL,
  submitter_email TEXT,
  correction_text TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON correction_requests(status);
CREATE INDEX IF NOT EXISTS idx_corrections_game ON correction_requests(game_id);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
