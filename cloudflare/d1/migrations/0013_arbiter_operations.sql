PRAGMA foreign_keys = ON;

ALTER TABLE games ADD COLUMN league_designation TEXT;
ALTER TABLE games ADD COLUMN league_designation_override INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN league_designation_updated_at TEXT;
ALTER TABLE games ADD COLUMN schedule_override INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_d1_games_league_designation ON games(league_designation);

CREATE TABLE IF NOT EXISTS arbiter_game_links (
  arbiter_game_id INTEGER PRIMARY KEY,
  game_id TEXT NOT NULL,
  last_modified_at TEXT,
  last_seen_at TEXT,
  source_status TEXT,
  source_payload TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_game_links_game ON arbiter_game_links(game_id);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_game_links_seen ON arbiter_game_links(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS arbiter_automation_runs (
  id TEXT PRIMARY KEY,
  season_id TEXT,
  trigger_source TEXT NOT NULL DEFAULT 'cloudflare',
  status TEXT NOT NULL DEFAULT 'running',
  summary TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_automation_runs_status ON arbiter_automation_runs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_automation_runs_season ON arbiter_automation_runs(season_id, started_at DESC);

CREATE TABLE IF NOT EXISTS arbiter_health_checks (
  id TEXT PRIMARY KEY,
  season_id TEXT,
  status TEXT NOT NULL,
  summary TEXT,
  changes TEXT,
  quarantines TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_health_checks_season ON arbiter_health_checks(season_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_health_checks_status ON arbiter_health_checks(status, created_at DESC);
