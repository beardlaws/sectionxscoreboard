PRAGMA foreign_keys = ON;

-- Provider-neutral live audio model. Cloudflare RealtimeKit is the first provider,
-- but no provider-specific identifiers are required by the application schema.
CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','live','ended','canceled')),
  provider TEXT NOT NULL DEFAULT 'realtimekit',
  provider_session_id TEXT,
  provider_metadata TEXT,
  public_enabled INTEGER NOT NULL DEFAULT 0,
  recording_enabled INTEGER NOT NULL DEFAULT 0,
  recording_provider_id TEXT,
  recording_url TEXT,
  scheduled_at TEXT,
  started_at TEXT,
  ended_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(game_id, id)
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_game ON broadcasts(game_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_provider_session ON broadcasts(provider, provider_session_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_public_live ON broadcasts(public_enabled, status)
  WHERE public_enabled = 1;

CREATE TRIGGER IF NOT EXISTS broadcasts_updated_at
AFTER UPDATE ON broadcasts
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE broadcasts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Application-owned permissions. subject_id intentionally does not foreign-key to
-- an auth vendor so auth providers can be swapped without migrating broadcast data.
CREATE TABLE IF NOT EXISTS broadcast_assignments (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('producer','broadcaster','color','sideline','scorekeeper')),
  active INTEGER NOT NULL DEFAULT 1,
  assigned_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(broadcast_id, subject_id, role)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_assignments_broadcast ON broadcast_assignments(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_assignments_subject ON broadcast_assignments(subject_id, active);

-- Lightweight join history for support, analytics and future listener-count work.
CREATE TABLE IF NOT EXISTS broadcast_participant_sessions (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  subject_id TEXT,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('publisher','listener')),
  provider_participant_id TEXT,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  left_at TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_broadcast_participant_sessions_broadcast
  ON broadcast_participant_sessions(broadcast_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_broadcast_participant_sessions_provider
  ON broadcast_participant_sessions(provider_participant_id);

-- Provider-neutral operational events make troubleshooting possible without
-- coupling the product to RealtimeKit-specific event names.
CREATE TABLE IF NOT EXISTS broadcast_events (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_subject_id TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_broadcast_events_broadcast
  ON broadcast_events(broadcast_id, created_at DESC);
