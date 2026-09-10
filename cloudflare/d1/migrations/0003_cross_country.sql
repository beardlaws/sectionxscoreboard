PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cross_country_meets (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  meet_name TEXT NOT NULL,
  meet_date TEXT NOT NULL,
  meet_time TEXT,
  location TEXT,
  meet_type TEXT NOT NULL DEFAULT 'Invitational',
  status TEXT NOT NULL DEFAULT 'Scheduled',
  notes TEXT,
  source TEXT,
  source_event_key TEXT,
  source_payload TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_xc_meets_date ON cross_country_meets(meet_date DESC);
CREATE INDEX IF NOT EXISTS idx_xc_meets_season ON cross_country_meets(season_id, meet_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_xc_meets_source_event ON cross_country_meets(source_event_key) WHERE source_event_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS cross_country_team_results (
  id TEXT PRIMARY KEY,
  meet_id TEXT NOT NULL REFERENCES cross_country_meets(id) ON DELETE CASCADE,
  sport_id TEXT NOT NULL REFERENCES sports(id),
  team_id TEXT REFERENCES teams(id),
  external_opponent_id TEXT REFERENCES external_opponents(id),
  team_score INTEGER,
  finish_place INTEGER,
  is_section_x INTEGER NOT NULL DEFAULT 0,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_xc_team_results_meet ON cross_country_team_results(meet_id, sport_id, finish_place);
CREATE INDEX IF NOT EXISTS idx_xc_team_results_team ON cross_country_team_results(team_id);

CREATE TABLE IF NOT EXISTS cross_country_dual_results (
  id TEXT PRIMARY KEY,
  meet_id TEXT NOT NULL REFERENCES cross_country_meets(id) ON DELETE CASCADE,
  sport_id TEXT NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  team_a_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_b_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_a_score INTEGER,
  team_b_score INTEGER,
  outcome_a TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'admin',
  notes TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_xc_dual_meet_sport ON cross_country_dual_results(meet_id, sport_id);
CREATE INDEX IF NOT EXISTS idx_xc_dual_team_a ON cross_country_dual_results(team_a_id);
CREATE INDEX IF NOT EXISTS idx_xc_dual_team_b ON cross_country_dual_results(team_b_id);
