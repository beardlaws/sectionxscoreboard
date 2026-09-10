PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contributor_auth_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_d1_contributor_auth_email ON contributor_auth_accounts(email);

CREATE TABLE IF NOT EXISTS contributor_auth_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT,
  FOREIGN KEY (account_id) REFERENCES contributor_auth_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_contributor_sessions_account ON contributor_auth_sessions(account_id,expires_at);

CREATE TABLE IF NOT EXISTS contributor_auth_codes (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES contributor_auth_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_d1_contributor_codes_account ON contributor_auth_codes(account_id,created_at DESC);
