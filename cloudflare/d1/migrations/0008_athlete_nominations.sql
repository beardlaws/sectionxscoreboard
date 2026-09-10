PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS athlete_nominations (
  id TEXT PRIMARY KEY,
  athlete_name TEXT NOT NULL,
  school_name TEXT NOT NULL,
  sport_name TEXT NOT NULL,
  grade TEXT,
  achievement TEXT NOT NULL,
  nominator_name TEXT,
  nominator_email TEXT,
  reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_d1_athlete_nominations_reviewed ON athlete_nominations(reviewed,created_at);
