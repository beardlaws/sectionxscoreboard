PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS advertise_inquiries (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  package_interest TEXT,
  school_interest TEXT,
  sport_interest TEXT,
  message TEXT,
  reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_d1_advertise_inquiries_reviewed ON advertise_inquiries(reviewed, created_at DESC);

CREATE TABLE IF NOT EXISTS sponsor_impressions (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  placement_type TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_sponsor_impressions_sponsor ON sponsor_impressions(sponsor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sponsor_viewable_impressions (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  placement_type TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_sponsor_viewable_sponsor ON sponsor_viewable_impressions(sponsor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sponsor_clicks (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  placement_type TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (sponsor_id) REFERENCES sponsors(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_sponsor_clicks_sponsor ON sponsor_clicks(sponsor_id, created_at DESC);
