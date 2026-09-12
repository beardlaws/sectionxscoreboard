PRAGMA foreign_keys = ON;

-- Preserve contributor-era Supabase auth registrations as claimable D1 accounts.
-- Password material cannot be migrated from Supabase, so these accounts are
-- intentionally marked as unclaimed and must be claimed by verifying the email.
INSERT OR IGNORE INTO contributor_auth_accounts
  (id,email,display_name,password_hash,password_salt,verified_at,created_at,updated_at)
VALUES
  ('7bae06b9-da8f-4d18-80fe-668a3fc21355','30mclear44@gmail.com','Matt McLear','__MIGRATED_UNCLAIMED__','__MIGRATED_UNCLAIMED__',NULL,'2026-08-27T13:32:22.544183Z',datetime('now')),
  ('a57c5b77-37c1-4fac-9fc8-dd766010d4ef','megh83j@gmail.com','Megh','__MIGRATED_UNCLAIMED__','__MIGRATED_UNCLAIMED__',NULL,'2026-08-28T01:38:05.912951Z',datetime('now')),
  ('69095d2b-f04b-498a-a7d2-4cbe9fa1bc8e','arquitt13@yahoo.com','Lisa Arquitt','__MIGRATED_UNCLAIMED__','__MIGRATED_UNCLAIMED__',NULL,'2026-08-29T10:24:34.499692Z',datetime('now')),
  ('77bbf123-7428-4536-8e81-d75bc3d6039f','averyb7713@gmail.com','Avery McLear','__MIGRATED_UNCLAIMED__','__MIGRATED_UNCLAIMED__',NULL,'2026-09-12T01:29:42.891802Z',datetime('now'));
