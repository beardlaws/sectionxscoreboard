# Cloudflare production launch gate

This branch is a launch candidate only when every **launch-critical** gate below is green. Production DNS is the final step, never a test step.

## Automated code and schema gates

- [x] Cloudflare/OpenNext-prepared Next build is fatal on compile failure.
- [x] Direct Supabase feature imports outside the rollback adapter are zero and CI-blocked.
- [x] Hidden Vercel URLs/env assumptions and direct Supabase runtime URLs are CI-blocked.
- [x] Cutover scripts are syntax-checked in CI.
- [x] D1 migrations are applied to a fresh local D1 database in CI.
- [x] Launch-critical D1 tables are queried after migration application.
- [x] Admin, contributor, photo, score, sponsor, Arbiter, fan and live-audio schemas compile in the Cloudflare build.

## Redirect and browser safety

- [x] Canonical apex -> www redirect moved out of Next and into the Cloudflare Worker edge entry point.
- [x] Worker redirect applies only when the incoming hostname is exactly `sectionxscoreboard.com`.
- [x] Scheduled Worker requests use the canonical www hostname and bypass the public apex redirect path.
- [x] Permissions Policy allows same-origin microphone access for live broadcasting.
- [ ] workers.dev staging confirms admin login/logout has no redirect loop in Chrome/Edge and mobile.
- [ ] workers.dev staging confirms `/admin/live-audio`, `/broadcast`, and a public listener page load correctly.

## Cloudflare infrastructure gates

- [x] Worker configuration declares D1 `DB`, R2 `PHOTOS`, static `ASSETS`, version metadata and Cron Triggers.
- [x] Cloudflare scheduled automation is hard-gated by `CLOUDFLARE_AUTOMATION_ENABLED=false` in staging.
- [x] Supabase production Arbiter/roster/watchdog jobs remain active while Vercel is production.
- [x] Supabase fan dispatch remains paused during migration to prevent duplicate sends. There are currently no pending/error fan events.
- [ ] Deployed Worker readiness v3 confirms `DB`, `PHOTOS`, `ASSETS`, admin auth, automation secret, Arbiter credentials, Resend, fan email provider and RealtimeKit credentials.
- [ ] Deployed Worker version metadata proves the expected launch commit is serving.
- [ ] R2 read/write/delete smoke test succeeds through the application routes.
- [ ] RealtimeKit create/broadcast/listen/end smoke test succeeds.

## Final data migration gates

The final sync command is `npm run d1:sync:final`. It is designed to be run only with the guarded read-only Supabase migration role.

- [x] Core schools/sports/seasons/teams/games data has a D1 seed path.
- [x] Athletes, rosters, coaches, photos, editorial content and settings have D1 seed paths.
- [x] Game Center stats, photo tags, playoffs and cross-country have D1 seed paths.
- [x] Contributor/fan state and notification history have D1 seed paths.
- [x] Arbiter links, mappings, health, roster state, sync history and exception resolutions have D1 seed paths.
- [x] Operational/history data now has a final-sync path, including submissions, corrections, game import provenance, score-alert subscriptions, sponsor analytics, site traffic and staff rankings.
- [x] Final photo migration rewrites every source photo to first-party R2 storage instead of trusting a stale migration flag.
- [x] School logo migration rewrites referenced legacy logo URLs to first-party R2 storage.
- [x] Final reconciliation compares all source-owned table counts, game freshness/state, R2 media pointers and key relational orphan checks.
- [ ] Run a fresh final sync immediately before the cutover rehearsal.
- [ ] Final reconciliation exits PASS with no mismatches.
- [ ] Readiness v3 reports source-critical counts consistent with the final Supabase snapshot.
- [ ] R2 object count is at least the number of referenced photo + logo objects and sampled URLs return successfully.

Current authoritative source baseline captured during the September 11 audit:

- games: 1398
- teams: 255
- schools: 24
- sports: 23
- athletes: 1867
- roster entries: 1878
- photos: 84
- Arbiter game links: 578
- referenced school logos: 24

These numbers are a diagnostic baseline only. The final sync/reconciliation must use the fresh counts at cutover time because production can continue changing while Vercel remains live.

## Staging workflow smoke tests

Public:
- [ ] Homepage, ticker and today's games.
- [ ] Game Center and social preview image.
- [ ] Team, school, sport and standings pages.
- [ ] Search.
- [ ] Photos, team albums, full-size image viewer and first-party R2 media.
- [ ] Harrisville boys soccer album regression test.
- [ ] Cross-country meet/team pages.
- [ ] Fan follows/alert settings.
- [ ] Sponsor tracking writes.

Admin/write paths:
- [ ] Admin login, session and logout.
- [ ] Quick score and score correction.
- [ ] Result exemption, postponed and canceled behavior.
- [ ] League designation and schedule overrides with audit records.
- [ ] School logo upload/read/delete replacement flow.
- [ ] Photo upload, moderation, tagging and delete.
- [ ] Contributor assignment/login/live score/photo submission.
- [ ] Sponsor CRUD/analytics.
- [ ] Cross-country result entry/import.
- [ ] Playoff CRUD/sync.
- [ ] Arbiter pull/health/roster/link workflows with Cloudflare automation still gated off.
- [ ] Live Audio broadcaster/listener lifecycle.

## Controlled scheduler handoff

Only after staging and reconciliation are green:

1. Stop the legacy Supabase scheduled jobs that Cloudflare will replace.
2. Verify no legacy scheduler is still running.
3. Set `CLOUDFLARE_AUTOMATION_ENABLED=true` on the production Worker.
4. Verify one controlled Cloudflare scheduler execution before relying on it.
5. Do not allow both scheduler systems to mutate/send simultaneously.

## Production cutover and rollback

- [x] Vercel and Supabase are currently intact as rollback.
- [x] Existing Vercel DNS target is documented: `f285b145eafa074c.vercel-dns-017.com`.
- [x] Root and www are currently gray-cloud/DNS-only while Vercel is production.
- [ ] Capture the exact launch Worker version/readiness response immediately before routing change.
- [ ] Proxy root and www to Cloudflare only after all staging launch gates pass.
- [ ] Immediately smoke test homepage, Game Center, admin auth, a D1 write, an R2 read/write and the live-audio admin route on production.
- [ ] If any launch-critical test fails, return both web records to gray-cloud/DNS-only Vercel routing and leave Supabase intact.
- [ ] Keep Vercel/Supabase available through a short rollback window after successful launch before downgrading/removing paid dependencies.

A green build is necessary, but the actual go-live decision requires **green CI + fresh exact data reconciliation + green Worker readiness + staging smoke tests**.
