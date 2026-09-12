PRAGMA foreign_keys = ON;

ALTER TABLE contributor_auth_accounts ADD COLUMN claim_required INTEGER NOT NULL DEFAULT 0;

UPDATE contributor_auth_accounts
SET claim_required = 1,
    verified_at = NULL,
    updated_at = datetime('now')
WHERE password_hash = '__MIGRATED_UNCLAIMED__';
