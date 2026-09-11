CREATE TABLE IF NOT EXISTS admin_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_events_type_created
  ON admin_events(event_type, created_at DESC);
