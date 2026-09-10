PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS fan_power_rank_ballots (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  sport_id TEXT NOT NULL,
  group_type TEXT NOT NULL,
  group_value TEXT NOT NULL,
  rankings TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start, sport_id, group_type, group_value, voter_hash),
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_fan_rank_ballots_group ON fan_power_rank_ballots(week_start,sport_id,group_type,group_value);

CREATE TABLE IF NOT EXISTS fan_power_rank_snapshots (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  sport_id TEXT NOT NULL,
  group_type TEXT NOT NULL,
  group_value TEXT NOT NULL,
  results TEXT NOT NULL DEFAULT '[]',
  ballot_count INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start, sport_id, group_type, group_value),
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_fan_rank_snapshots_week ON fan_power_rank_snapshots(week_start,published);

CREATE TABLE IF NOT EXISTS fan_top_play_nominations (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  athlete_name TEXT NOT NULL,
  school_id TEXT,
  sport_id TEXT,
  game_date TEXT,
  opponent TEXT,
  play_description TEXT NOT NULL,
  why_top_five TEXT,
  submitter_name TEXT,
  submitter_email TEXT,
  voter_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL,
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_d1_fan_top_plays_week ON fan_top_play_nominations(week_start,status,created_at);
CREATE INDEX IF NOT EXISTS idx_d1_fan_top_plays_voter ON fan_top_play_nominations(week_start,voter_hash);

CREATE TABLE IF NOT EXISTS fan_school_support (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  school_id TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start,voter_hash),
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_fan_school_support_week ON fan_school_support(week_start,school_id);

CREATE TABLE IF NOT EXISTS fan_school_support_snapshots (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  school_id TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start,school_id),
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_fan_school_snapshots_week ON fan_school_support_snapshots(week_start,published,votes);

CREATE TABLE IF NOT EXISTS fan_game_votes (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  game_id TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start,voter_hash),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_fan_game_votes_week ON fan_game_votes(week_start,game_id);

CREATE TABLE IF NOT EXISTS fan_game_vote_snapshots (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  game_id TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start,game_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
