PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS arbiter_team_links (
  team_id TEXT PRIMARY KEY,
  arbiter_team_id INTEGER NOT NULL,
  arbiter_school_id INTEGER,
  source TEXT,
  confidence TEXT,
  observed_count INTEGER DEFAULT 0,
  first_seen_at TEXT,
  last_seen_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_team_links_arbiter_team ON arbiter_team_links(arbiter_team_id);

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

CREATE TABLE IF NOT EXISTS arbiter_sync_runs (
  id TEXT PRIMARY KEY,
  season_id TEXT,
  mode TEXT,
  window_start TEXT,
  window_end TEXT,
  status TEXT,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_sync_runs_season ON arbiter_sync_runs(season_id, created_at DESC);

CREATE TABLE IF NOT EXISTS arbiter_sync_actions (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  arbiter_game_id INTEGER,
  game_id TEXT,
  action TEXT,
  outcome TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES arbiter_sync_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_sync_actions_run ON arbiter_sync_actions(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_sync_actions_game ON arbiter_sync_actions(game_id);

CREATE TABLE IF NOT EXISTS arbiter_health_checks (
  id TEXT PRIMARY KEY,
  season_id TEXT,
  status TEXT,
  summary TEXT,
  changes TEXT,
  quarantines TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_health_checks_season ON arbiter_health_checks(season_id, created_at DESC);

CREATE TABLE IF NOT EXISTS arbiter_automation_runs (
  id TEXT PRIMARY KEY,
  season_id TEXT,
  trigger_source TEXT,
  status TEXT,
  summary TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_automation_runs_season ON arbiter_automation_runs(season_id, started_at DESC);

CREATE TABLE IF NOT EXISTS arbiter_roster_freshness (
  team_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  arbiter_team_id INTEGER,
  status TEXT,
  verified INTEGER DEFAULT 0,
  reason TEXT,
  incoming_count INTEGER,
  previous_count INTEGER,
  previous_overlap REAL,
  evidence TEXT,
  checked_at TEXT,
  PRIMARY KEY (team_id, season_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_roster_freshness_status ON arbiter_roster_freshness(season_id,status,verified);

CREATE TABLE IF NOT EXISTS arbiter_roster_automation_runs (
  id TEXT PRIMARY KEY,
  season_id TEXT,
  trigger_source TEXT,
  status TEXT,
  summary TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  FOREIGN KEY (season_id) REFERENCES seasons(id)
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_roster_runs_season ON arbiter_roster_automation_runs(season_id, started_at DESC);

CREATE TABLE IF NOT EXISTS arbiter_school_mappings (
  school_id TEXT PRIMARY KEY,
  school_url TEXT,
  entity_id TEXT,
  last_verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS arbiter_team_mappings (
  team_id TEXT PRIMARY KEY,
  school_id TEXT,
  schedule_url TEXT,
  arbiter_team_id TEXT,
  last_verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_team_mappings_school ON arbiter_team_mappings(school_id);

CREATE TABLE IF NOT EXISTS arbiter_shared_event_ids (
  arbiter_game_id INTEGER PRIMARY KEY,
  reason TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_d1_arbiter_shared_event_active ON arbiter_shared_event_ids(active);
