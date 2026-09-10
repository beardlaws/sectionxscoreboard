PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS correction_requests (
  id TEXT PRIMARY KEY,
  game_id TEXT,
  submitter_name TEXT,
  submitter_email TEXT,
  correction_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_corrections_status_created ON correction_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_d1_corrections_game ON correction_requests(game_id);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  submitter_name TEXT,
  submitter_email TEXT,
  sport_name TEXT,
  home_team_name TEXT,
  away_team_name TEXT,
  home_score INTEGER,
  away_score INTEGER,
  game_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_d1_submissions_status_created ON submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_d1_submissions_game_date ON submissions(game_date);
