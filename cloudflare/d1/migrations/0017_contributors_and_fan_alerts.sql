PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contributor_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE,
  display_name TEXT,
  public_credit_name TEXT,
  email TEXT,
  school_id TEXT,
  bio TEXT,
  status TEXT DEFAULT 'pending',
  roles TEXT,
  trust_level TEXT,
  can_submit_photos INTEGER DEFAULT 1,
  can_tag_photos INTEGER DEFAULT 0,
  can_submit_scores INTEGER DEFAULT 1,
  can_live_score INTEGER DEFAULT 0,
  can_publish_photos INTEGER DEFAULT 0,
  submissions_count INTEGER DEFAULT 0,
  verified_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  approved_at TEXT,
  approved_by TEXT,
  last_active_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_d1_contributor_profiles_status ON contributor_profiles(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_d1_contributor_profiles_school ON contributor_profiles(school_id,status);
CREATE INDEX IF NOT EXISTS idx_d1_contributor_profiles_email ON contributor_profiles(email);

CREATE TABLE IF NOT EXISTS contributor_game_assignments (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  assignment_role TEXT,
  active INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contributor_id) REFERENCES contributor_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  UNIQUE(contributor_id,game_id,assignment_role)
);
CREATE INDEX IF NOT EXISTS idx_d1_contributor_assignments_game ON contributor_game_assignments(game_id,active);

CREATE TABLE IF NOT EXISTS contributor_activity (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL,
  event_type TEXT,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contributor_id) REFERENCES contributor_profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_contributor_activity_profile ON contributor_activity(contributor_id,created_at DESC);

CREATE TABLE IF NOT EXISTS contributor_coverage_requests (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  coverage_role TEXT,
  status TEXT DEFAULT 'open',
  notes TEXT,
  requested_by TEXT,
  claimed_by TEXT,
  claimed_at TEXT,
  closed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (claimed_by) REFERENCES contributor_profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_d1_coverage_requests_status ON contributor_coverage_requests(status,created_at DESC);

CREATE TABLE IF NOT EXISTS contributor_score_updates (
  id TEXT PRIMARY KEY,
  contributor_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  game_status TEXT,
  note TEXT,
  update_type TEXT,
  publication_status TEXT,
  before_state TEXT,
  after_state TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (contributor_id) REFERENCES contributor_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_contributor_score_updates_game ON contributor_score_updates(game_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_d1_contributor_score_updates_profile ON contributor_score_updates(contributor_id,created_at DESC);

CREATE TABLE IF NOT EXISTS fan_follow_preferences (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  team_id TEXT,
  athlete_id TEXT,
  alert_finals INTEGER DEFAULT 1,
  alert_schedule_changes INTEGER DEFAULT 1,
  alert_live INTEGER DEFAULT 0,
  alert_photos INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  manage_token TEXT UNIQUE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE,
  CHECK ((team_id IS NOT NULL AND athlete_id IS NULL) OR (team_id IS NULL AND athlete_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_d1_follow_email ON fan_follow_preferences(email,active);
CREATE INDEX IF NOT EXISTS idx_d1_follow_team ON fan_follow_preferences(team_id,active);
CREATE INDEX IF NOT EXISTS idx_d1_follow_athlete ON fan_follow_preferences(athlete_id,active);

CREATE TABLE IF NOT EXISTS fan_notification_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  game_id TEXT,
  photo_id TEXT,
  dedupe_key TEXT UNIQUE,
  payload TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT,
  last_error TEXT,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_notification_events_status ON fan_notification_events(status,created_at);

CREATE TABLE IF NOT EXISTS fan_notification_deliveries (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  follow_id TEXT,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  provider TEXT,
  provider_id TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  sent_at TEXT,
  FOREIGN KEY (event_id) REFERENCES fan_notification_events(id) ON DELETE CASCADE,
  FOREIGN KEY (follow_id) REFERENCES fan_follow_preferences(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_d1_notification_deliveries_event ON fan_notification_deliveries(event_id,status);
CREATE INDEX IF NOT EXISTS idx_d1_notification_deliveries_email ON fan_notification_deliveries(email,created_at DESC);
