PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_exception_resolutions (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  arbiter_game_id TEXT NOT NULL,
  game_id TEXT,
  exception_bucket TEXT NOT NULL,
  resolution TEXT NOT NULL CHECK (resolution IN ('confirm-scrimmage','keep-quarantined')),
  note TEXT,
  evidence_fingerprint TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_exception_resolutions_active_unique
  ON admin_exception_resolutions(season_id, arbiter_game_id)
  WHERE active = 1;

CREATE INDEX IF NOT EXISTS idx_admin_exception_resolutions_season_active
  ON admin_exception_resolutions(season_id, active, created_at DESC);
