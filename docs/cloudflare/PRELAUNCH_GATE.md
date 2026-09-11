# Cloudflare prelaunch gate

This branch is a launch candidate only when every gate below is green. Do not point production DNS at the Worker merely because the app compiles.

## Automated gates

- [x] Cloudflare/OpenNext-prepared Next build is fatal on compile failure.
- [x] Direct Supabase feature imports are enumerated in CI.
- [x] D1 migrations are applied to a fresh local D1 database in CI.
- [x] Critical D1 tables are queried after migration application.
- [ ] Direct Supabase feature import count is zero. Once zero, change the CI audit from informational to fatal.

## Dependency migration still blocking cutover

Current remaining dependency families are concentrated in:

- Admin Game Center list/score desk.
- Admin Games manager.
- Admin Playoffs manager.
- Admin Traffic dashboard.
- Arbiter roster scan/automation.

Do not hide these behind a fake Supabase-compatible shim just to reach zero imports. Move them to D1 APIs/repositories/services.

## Cloudflare infrastructure gates

- [ ] Preview R2 bucket `sectionxscoreboard-photos-preview` exists in the Cloudflare account.
- [x] Worker configuration declares the `PHOTOS` R2 binding.
- [ ] Preview deployment confirms `DB`, `PHOTOS`, assets and required secrets are present.
- [ ] Upload/read/delete smoke test succeeds against R2.
- [ ] Legacy logo/photo objects are reconciled with R2 object counts and sampled URLs.
- [ ] Cloudflare Cron/Workflow job design covers every current Vercel cron and Supabase pg_cron job.
- [ ] New Cloudflare schedules remain disabled until D1-safe jobs are proven and old/new schedulers cannot race.

## Data gates

- [ ] Fresh production snapshot is imported to D1 immediately before cutover rehearsal.
- [ ] Row counts reconcile for critical tables.
- [ ] Sample relational checks pass: games -> teams/schools/sports/seasons, playoff records, contributors, sponsors, photos, XC, Arbiter links.
- [ ] Final delta sync procedure is documented and rehearsed.

## Workflow smoke tests

Public:
- [ ] Homepage/ticker/today's games.
- [ ] Game Center and social preview image.
- [ ] Team/school/sport pages and standings.
- [ ] Search.
- [ ] Photos, team albums and R2-served media.
- [ ] Cross-country meet/team pages.
- [ ] Fan follows/alerts and sponsor tracking.

Admin/write paths:
- [ ] Admin login/session/logout.
- [ ] Quick score and score correction.
- [ ] Result exemption/postponed/canceled behavior.
- [ ] League designation and schedule overrides with audit records.
- [ ] School logo upload.
- [ ] Photo moderation/tagging/delete.
- [ ] Contributor assignment/login/live score/photo submission.
- [ ] Sponsor CRUD/analytics.
- [ ] Cross-country result entry/import.
- [ ] Playoff CRUD/sync.
- [ ] Arbiter pull/health/roster/link workflows.

## Cutover / rollback gate

- [ ] Vercel and Supabase remain untouched and usable as rollback during initial Cloudflare production validation.
- [ ] Production DNS/routing change is the final step, not a test step.
- [ ] Rollback instructions and previous routing target are captured before cutover.

A green build is necessary, not sufficient. Production cutover requires all launch-critical gates above to be green.
