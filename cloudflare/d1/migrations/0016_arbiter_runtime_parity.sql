PRAGMA foreign_keys = ON;

ALTER TABLE schools ADD COLUMN arbiter_entity_id TEXT;
ALTER TABLE schools ADD COLUMN arbiter_school_url TEXT;
CREATE INDEX IF NOT EXISTS idx_d1_schools_arbiter_entity ON schools(arbiter_entity_id);

CREATE TABLE IF NOT EXISTS admin_exception_resolutions (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  arbiter_game_id TEXT NOT NULL,
  game_id TEXT,
  exception_bucket TEXT,
  resolution TEXT NOT NULL,
  note TEXT,
  evidence_fingerprint TEXT,
  evidence TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_d1_exception_resolutions_season ON admin_exception_resolutions(season_id,active,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_d1_exception_resolutions_arbiter ON admin_exception_resolutions(arbiter_game_id,active);
