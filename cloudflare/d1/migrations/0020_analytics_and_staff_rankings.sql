PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS site_traffic_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_name TEXT NOT NULL DEFAULT 'page_view',
  path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  referrer_host TEXT,
  session_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  user_agent TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_bot INTEGER NOT NULL DEFAULT 0,
  landing_path TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  device_type TEXT
);
CREATE INDEX IF NOT EXISTS idx_d1_traffic_occurred_at ON site_traffic_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_d1_traffic_path ON site_traffic_events(path, occurred_at);
CREATE INDEX IF NOT EXISTS idx_d1_traffic_source ON site_traffic_events(source, occurred_at);
CREATE INDEX IF NOT EXISTS idx_d1_traffic_visitor ON site_traffic_events(visitor_id, occurred_at);

CREATE TABLE IF NOT EXISTS staff_power_rank_snapshots (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  sport_id TEXT NOT NULL,
  group_type TEXT NOT NULL CHECK (group_type IN ('class','division','all')),
  group_value TEXT NOT NULL DEFAULT 'All',
  rankings TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(week_start, sport_id, group_type, group_value),
  FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_staff_power_rank_week ON staff_power_rank_snapshots(week_start, sport_id, group_type, group_value);
