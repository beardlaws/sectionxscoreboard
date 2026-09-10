PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS score_alert_subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  school_id TEXT,
  all_section_x INTEGER DEFAULT 0,
  confirmed INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_score_alert_email ON score_alert_subscriptions(email,confirmed);
CREATE INDEX IF NOT EXISTS idx_d1_score_alert_school ON score_alert_subscriptions(school_id,confirmed);
