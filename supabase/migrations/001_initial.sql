-- ============================================================
-- Section X Scoreboard — Initial Migration
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SCHOOLS
-- ============================================================
CREATE TABLE schools (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name   TEXT NOT NULL,
  mascot        TEXT,
  city          TEXT,
  county        TEXT,
  primary_color TEXT DEFAULT '#1e3a5f',
  secondary_color TEXT DEFAULT '#ffffff',
  alias         TEXT,
  slug          TEXT UNIQUE NOT NULL,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schools_slug ON schools(slug);
CREATE INDEX idx_schools_county ON schools(county);

-- ============================================================
-- SPORTS
-- ============================================================
CREATE TABLE sports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport_name        TEXT NOT NULL,
  gender            TEXT NOT NULL DEFAULT 'Both',     -- Boys, Girls, Both
  season_type       TEXT NOT NULL,                    -- Spring, Fall, Winter
  homepage_priority INT DEFAULT 99,
  active_public     BOOLEAN DEFAULT true,
  slug              TEXT UNIQUE NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sports_slug ON sports(slug);
CREATE INDEX idx_sports_season_type ON sports(season_type);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
  sport_id    UUID REFERENCES sports(id) ON DELETE CASCADE,
  team_name   TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  level       TEXT DEFAULT 'Varsity',  -- Varsity, JV, Modified
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, sport_id, level)
);

CREATE INDEX idx_teams_school ON teams(school_id);
CREATE INDEX idx_teams_sport ON teams(sport_id);
CREATE INDEX idx_teams_slug ON teams(slug);

-- ============================================================
-- SEASONS
-- ============================================================
CREATE TABLE seasons (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  year        INT NOT NULL,
  season_type TEXT NOT NULL,   -- Spring, Fall, Winter
  is_active   BOOLEAN DEFAULT false,
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seasons_active ON seasons(is_active);
CREATE INDEX idx_seasons_year_type ON seasons(year, season_type);

-- ============================================================
-- TEAM SEASONS
-- ============================================================
CREATE TABLE team_seasons (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id           UUID REFERENCES teams(id) ON DELETE CASCADE,
  season_id         UUID REFERENCES seasons(id) ON DELETE CASCADE,
  class             TEXT,       -- A, B, C, D
  division          TEXT,       -- Central, East, West
  active_for_season BOOLEAN DEFAULT true,
  display_team_name TEXT,
  is_coop           BOOLEAN DEFAULT false,
  coop_schools      TEXT,
  notes             TEXT,
  UNIQUE(team_id, season_id)
);

CREATE INDEX idx_team_seasons_team ON team_seasons(team_id);
CREATE INDEX idx_team_seasons_season ON team_seasons(season_id);

-- ============================================================
-- EXTERNAL OPPONENTS
-- ============================================================
CREATE TABLE external_opponents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  slug         TEXT UNIQUE,
  city         TEXT,
  state        TEXT DEFAULT 'NY',
  section      TEXT,
  is_section_x BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GAMES
-- ============================================================
CREATE TABLE games (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  season_id               UUID REFERENCES seasons(id),
  sport_id                UUID REFERENCES sports(id),
  home_team_id            UUID REFERENCES teams(id),
  away_team_id            UUID REFERENCES teams(id),
  external_home_opponent_id UUID REFERENCES external_opponents(id),
  external_away_opponent_id UUID REFERENCES external_opponents(id),
  game_date               DATE NOT NULL,
  game_time               TIME,
  location                TEXT,
  home_score              INT,
  away_score              INT,
  status                  TEXT NOT NULL DEFAULT 'Scheduled',
  -- Scheduled, Live, Final, Postponed, Canceled
  verification_status     TEXT NOT NULL DEFAULT 'Reported',
  -- Reported, Verified, Official
  source                  TEXT,
  -- admin, public_submission, import_paste, import_csv, import_arbiter
  notes                   TEXT,
  featured                BOOLEAN DEFAULT false,
  game_of_the_night       BOOLEAN DEFAULT false,
  rescheduled_date        DATE,
  doubleheader_group_id   UUID,
  game_number             INT,    -- 1 or 2 for doubleheaders
  event_name              TEXT,   -- Tournaments, invitationals
  neutral_site            BOOLEAN DEFAULT false,
  import_id               UUID,   -- links to import_logs
  parser_confidence       TEXT,   -- High, Medium, Low
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_games_date ON games(game_date DESC);
CREATE INDEX idx_games_season ON games(season_id);
CREATE INDEX idx_games_sport ON games(sport_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_home_team ON games(home_team_id);
CREATE INDEX idx_games_away_team ON games(away_team_id);
CREATE INDEX idx_games_featured ON games(featured) WHERE featured = true;
CREATE INDEX idx_games_gotn ON games(game_of_the_night) WHERE game_of_the_night = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SUBMISSIONS (public score submissions)
-- ============================================================
CREATE TABLE submissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submitter_name  TEXT NOT NULL,
  submitter_email TEXT,
  sport_name      TEXT,
  home_team_name  TEXT,
  away_team_name  TEXT,
  home_score      INT,
  away_score      INT,
  game_date       DATE,
  notes           TEXT,
  status          TEXT DEFAULT 'pending',  -- pending, approved, rejected
  reviewed_by     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submissions_status ON submissions(status);

-- ============================================================
-- PHOTOS
-- ============================================================
CREATE TABLE photos (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submitter_name          TEXT NOT NULL,
  submitter_email         TEXT,
  photographer_credit_name TEXT,
  school_id               UUID REFERENCES schools(id),
  team_id                 UUID REFERENCES teams(id),
  game_id                 UUID REFERENCES games(id),
  sport_id                UUID REFERENCES sports(id),
  caption                 TEXT,
  photo_url               TEXT NOT NULL,
  permission_confirmed    BOOLEAN DEFAULT false,
  approved                BOOLEAN DEFAULT false,
  featured                BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_approved ON photos(approved);
CREATE INDEX idx_photos_featured ON photos(featured) WHERE featured = true;
CREATE INDEX idx_photos_school ON photos(school_id);
CREATE INDEX idx_photos_sport ON photos(sport_id);

-- ============================================================
-- SHOUTOUTS
-- ============================================================
CREATE TABLE shoutouts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submitter_name TEXT NOT NULL,
  submitter_email TEXT,
  school_id      UUID REFERENCES schools(id),
  team_id        UUID REFERENCES teams(id),
  game_id        UUID REFERENCES games(id),
  athlete_name   TEXT,
  shoutout_type  TEXT NOT NULL,
  description    TEXT NOT NULL,
  approved       BOOLEAN DEFAULT false,
  featured       BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shoutouts_approved ON shoutouts(approved);

-- ============================================================
-- SPONSORS
-- ============================================================
CREATE TABLE sponsors (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name  TEXT NOT NULL,
  contact_name   TEXT,
  contact_email  TEXT,
  website_url    TEXT,
  logo_url       TEXT,
  tagline        TEXT,
  placement      TEXT NOT NULL,
  active         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sponsors_placement ON sponsors(placement);
CREATE INDEX idx_sponsors_active ON sponsors(active);

-- ============================================================
-- CORRECTION REQUESTS
-- ============================================================
CREATE TABLE correction_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id         UUID REFERENCES games(id),
  submitter_name  TEXT NOT NULL,
  submitter_email TEXT,
  correction_text TEXT NOT NULL,
  status          TEXT DEFAULT 'open',   -- open, resolved, dismissed
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_corrections_status ON correction_requests(status);
CREATE INDEX idx_corrections_game ON correction_requests(game_id);

-- ============================================================
-- IMPORT LOGS
-- ============================================================
CREATE TABLE import_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_type     TEXT NOT NULL,  -- paste, csv, arbiter
  raw_input       TEXT,
  rows_parsed     INT DEFAULT 0,
  rows_approved   INT DEFAULT 0,
  rows_rejected   INT DEFAULT 0,
  status          TEXT DEFAULT 'pending',  -- pending, completed
  imported_by     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SITE SETTINGS
-- ============================================================
CREATE TABLE site_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Public read access for display tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE shoutouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_opponents ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Public SELECT policies (read-only for visitors)
CREATE POLICY "Public read schools" ON schools FOR SELECT USING (true);
CREATE POLICY "Public read sports" ON sports FOR SELECT USING (true);
CREATE POLICY "Public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read team_seasons" ON team_seasons FOR SELECT USING (true);
CREATE POLICY "Public read seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "Public read games" ON games FOR SELECT USING (true);
CREATE POLICY "Public read approved photos" ON photos FOR SELECT USING (approved = true);
CREATE POLICY "Public read approved shoutouts" ON shoutouts FOR SELECT USING (approved = true);
CREATE POLICY "Public read active sponsors" ON sponsors FOR SELECT USING (active = true);
CREATE POLICY "Public read external_opponents" ON external_opponents FOR SELECT USING (true);
CREATE POLICY "Public read site_settings" ON site_settings FOR SELECT USING (true);

-- Public INSERT for submissions (anyone can submit)
CREATE POLICY "Public submit scores" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public submit photos" ON photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public submit shoutouts" ON shoutouts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public submit corrections" ON correction_requests FOR INSERT WITH CHECK (true);

-- Service role bypass (admin operations use service role key)
-- The admin app uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS automatically
