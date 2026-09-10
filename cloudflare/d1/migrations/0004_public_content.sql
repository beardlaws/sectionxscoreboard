PRAGMA foreign_keys = ON;

-- Core already created sponsors/photos/shoutouts in 0001. Add parity columns here
-- before creating indexes that reference them.
ALTER TABLE sponsors ADD COLUMN placement_type TEXT;
ALTER TABLE sponsors ADD COLUMN school_id TEXT;
ALTER TABLE sponsors ADD COLUMN sport_id TEXT;
ALTER TABLE sponsors ADD COLUMN price_monthly REAL;
ALTER TABLE sponsors ADD COLUMN start_date TEXT;
ALTER TABLE sponsors ADD COLUMN end_date TEXT;
ALTER TABLE sponsors ADD COLUMN contact_phone TEXT;
ALTER TABLE sponsors ADD COLUMN notes TEXT;
ALTER TABLE sponsors ADD COLUMN show_on_scores INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_d1_sponsors_placement_type ON sponsors(placement_type);
CREATE INDEX IF NOT EXISTS idx_d1_sponsors_school ON sponsors(school_id);
CREATE INDEX IF NOT EXISTS idx_d1_sponsors_sport ON sponsors(sport_id);

ALTER TABLE photos ADD COLUMN contributor_id TEXT;
ALTER TABLE photos ADD COLUMN contributor_user_id TEXT;
ALTER TABLE photos ADD COLUMN tag_reviewed INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_d1_photos_team ON photos(team_id);
CREATE INDEX IF NOT EXISTS idx_d1_photos_game ON photos(game_id);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS athletes (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  slug TEXT UNIQUE,
  source TEXT,
  source_key TEXT,
  source_url TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (school_id) REFERENCES schools(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_athletes_school ON athletes(school_id);
CREATE INDEX IF NOT EXISTS idx_d1_athletes_slug ON athletes(slug);

CREATE TABLE IF NOT EXISTS coaches (
  id TEXT PRIMARY KEY,
  school_id TEXT,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  slug TEXT UNIQUE,
  source TEXT,
  source_key TEXT,
  source_url TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (school_id) REFERENCES schools(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_coaches_school ON coaches(school_id);
CREATE INDEX IF NOT EXISTS idx_d1_coaches_slug ON coaches(slug);

CREATE TABLE IF NOT EXISTS roster_entries (
  id TEXT PRIMARY KEY,
  athlete_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  jersey_number TEXT,
  class_year TEXT,
  position TEXT,
  height TEXT,
  captain INTEGER DEFAULT 0,
  source TEXT,
  source_url TEXT,
  active INTEGER DEFAULT 1,
  imported_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_roster_team_season ON roster_entries(team_id, season_id, active);
CREATE INDEX IF NOT EXISTS idx_d1_roster_athlete ON roster_entries(athlete_id);

CREATE TABLE IF NOT EXISTS team_coaches (
  id TEXT PRIMARY KEY,
  coach_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  title TEXT,
  source TEXT,
  source_url TEXT,
  active INTEGER DEFAULT 1,
  imported_at TEXT,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (coach_id) REFERENCES coaches(id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_team_coaches_team_season ON team_coaches(team_id, season_id, active);

CREATE TABLE IF NOT EXISTS spotlights (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  author TEXT,
  school_slug TEXT,
  sport_name TEXT,
  published INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_d1_spotlights_public ON spotlights(published, featured, created_at);

CREATE TABLE IF NOT EXISTS athlete_of_week (
  id TEXT PRIMARY KEY,
  athlete_name TEXT NOT NULL,
  school_id TEXT,
  sport_name TEXT,
  grade TEXT,
  stats TEXT,
  body TEXT,
  photo_url TEXT,
  week_of TEXT,
  published INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (school_id) REFERENCES schools(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_aow_public ON athlete_of_week(published, week_of);

CREATE TABLE IF NOT EXISTS weekly_recaps (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT,
  summary TEXT,
  published_date TEXT,
  season_label TEXT,
  week_label TEXT,
  facebook_url TEXT,
  facebook_embed_url TEXT,
  youtube_url TEXT,
  thumbnail_url TEXT,
  sponsor_id TEXT,
  published INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_weekly_recaps_public ON weekly_recaps(published, published_date);
