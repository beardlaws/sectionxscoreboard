# Section X Scoreboard — Cloudflare Migration Audit

Audit date: 2026-09-10

## Objective

Move Section X Scoreboard from Vercel + Supabase to a Cloudflare-first stack while preserving public behavior, admin behavior, Arbiter automation, contributor workflows, photos, analytics, standings, rankings, and existing URLs.

The migration must be zero/near-zero downtime, reversible during cutover, and avoid hard vendor lock-in. Business logic should remain portable TypeScript with provider-specific code isolated behind adapters.

## Current production stack

- Next.js 14.2 / React 18 / TypeScript
- Vercel Pro hosting, GitHub-connected production deployments
- Supabase Postgres 17, Auth, Storage, Vault, pg_cron, pg_net
- Arbiter Partner API via OAuth client credentials and standard fetch
- Resend or Brevo for fan-alert email delivery
- sectionxscoreboard.com and www.sectionxscoreboard.com on Vercel

## Production inventory

### Application surface

The repository is a full application rather than a static site. It includes:

- public scores, standings, schools, teams, sports, game center, playoffs, search, photos, weekly recap, contributor tools, fan zone, cross country, nominations, submissions and sponsor surfaces
- extensive admin tools for scores, games, schedules, Arbiter sync, rosters, exceptions, contributors, photos, sponsors, analytics, playoffs, seasons, settings and operations
- many API route handlers
- several scheduled jobs
- reusable sports/domain logic under src/lib

### Database

Live Supabase public schema currently contains:

- 69 base tables
- 3 views
- 20 custom public functions
- 11 non-internal triggers
- 50 RLS policies

Representative production row counts at audit time:

- sponsor_impressions: ~12,022
- site_traffic_events: ~4,737
- sponsor_viewable_impressions: ~3,945
- arbiter_sync_actions: ~3,791
- roster_entries: ~1,848
- athletes: ~1,837
- games: ~1,397
- game_import_sources: ~1,040
- arbiter_game_links: ~576
- teams: ~255

This is small enough for D1 by a very wide margin.

### Data type conversion requirements

Postgres types in use that need a deliberate D1/SQLite representation:

- uuid -> TEXT
- timestamptz/date/time -> ISO-8601 TEXT or normalized date/time TEXT
- boolean -> INTEGER/boolean-compatible SQLite representation
- jsonb -> JSON stored as TEXT and queried with SQLite JSON functions where required
- bigint -> INTEGER (64-bit)
- numeric -> REAL/NUMERIC-compatible representation depending on field semantics
- one ARRAY field (contributor_profiles.roles) -> JSON TEXT
- one interval field (cross_country_individual_results.finish_time) -> normalized integer duration, preferably milliseconds, with formatting in application code

Primary and foreign-key identifiers should preserve their current UUID string values during migration so relationships and external references remain stable.

### Storage

Supabase Storage contains two public buckets:

- logos: 26 objects, ~11.9 MB, current per-file limit 2 MB
- photos: 55 objects, ~305.6 MB

Target: R2. Preserve object paths where practical. Use a stable Section X asset hostname so database/application URLs are not coupled to the R2 implementation hostname.

### Authentication

Admin authentication is already provider-independent:

- HMAC-SHA256 signed session cookie
- Web Crypto API
- ADMIN_PASSWORD and ADMIN_SESSION_TOKEN secrets
- middleware protects /admin/* and /api/admin/*

This is Worker-compatible and should be retained unless there is a separate security reason to change it.

Contributor authentication currently uses Supabase Auth:

- 3 Supabase auth users total at audit time
- 2 contributor_profiles
- browser signup/session/signout through Supabase
- bearer-token verification in contributor APIs

Target: a portable TypeScript auth layer backed by D1. Better Auth currently supports D1 directly and remains portable to other SQL backends. Preserve contributor profile IDs and associations. Existing users may require a one-time password reset/invite unless password hashes can be safely and compatibly migrated.

### Supabase Storage usage in code

Direct Storage behavior exists in:

- public photo submission
- admin photo deletion/cleanup
- school logo upload

These become an AssetStore interface with an R2 implementation.

### Supabase database access in code

There are both wrapper-based and direct Supabase calls. Important existing seam:

- src/lib/adminDb.ts already sends admin mutations through /api/admin/db

This route can keep the same front-end contract while its backend changes from Supabase to the portable repository layer.

Direct Supabase imports/calls remain in server pages, admin pages, API routes, contributor flows and photo flows. These must be removed from feature code before Supabase can be shut off.

## Critical current security issue

Supabase reports 21 public tables with Row Level Security disabled, including high-value application tables such as games, photos, submissions, sponsors, site_settings, playoff tables and others.

Do NOT blindly enable RLS in production during migration prep because existing direct client access may depend on the current behavior and enabling RLS without complete policies can break production.

The Cloudflare target removes this class of exposure by keeping D1 private behind the Worker/API. Browsers should no longer receive a generic database credential or directly query the database. Authorization must be enforced in application/API services.

## Postgres behavior that must be preserved

### Custom functions / RPC replacements

Move these behaviors out of Postgres and into portable TypeScript services where practical:

- admin_sponsor_analytics -> AnalyticsService
- enforce_scrimmage_game_integrity -> GameIntegrityService
- recover_sectionx_stale_roster_run -> ArbiterRosterRecovery service/job
- sectionx_arbiter_cron_status -> AutomationStatusService
- sectionx_enqueue_game_fan_events -> FanEventService called after game mutation
- sectionx_enqueue_photo_fan_event -> FanEventService called after photo approval
- sectionx_guard_arbiter_roster_write -> RosterFreshnessPolicy before write
- sectionx_roster_cron_status -> AutomationStatusService
- sectionx_roster_publicly_visible -> RosterVisibilityPolicy / repository filter
- site_traffic_dashboard -> AnalyticsService using D1 SQL
- trigger_sectionx_arbiter_pull -> scheduled handler / queue producer
- trigger_sectionx_arbiter_rosters -> scheduled handler / queue producer
- trigger_sectionx_fan_alerts -> scheduled handler / queue consumer
- trigger_sectionx_xc_schedule_backfill -> XC sync service
- trigger_sectionx_xc_schedule_sync -> XC sync service
- verify_sectionx_automation_key -> Worker secret verification, or eliminate public scheduler endpoint when using internal scheduled handlers

Simple updated_at behavior can be handled in repositories or D1 triggers, but business rules should stay in TypeScript for portability.

### Trigger behaviors that must not be lost

- scrimmages must not retain scores or Final state when classified as scrimmages
- game transitions to Live/Final and schedule changes must enqueue deduplicated fan events
- photo approval must enqueue a deduplicated photo event
- active-season Arbiter roster/coach writes must be blocked unless freshness is verified current
- current Arbiter rosters must remain hidden from public output until verified current
- updated_at fields must continue to be maintained

### Views

Three public views exist and can become D1 views or service queries:

- arbiter_roster_freshness_admin
- arbiter_roster_publication_status_admin
- fan_follow_counts

Preference: retain simple stable SQL views where useful, but keep policy/business decisions in TypeScript.

## Scheduling inventory

### Vercel cron jobs

Current repository vercel.json schedules include:

- Arbiter health check
- Cross-country sync
- multiple overnight score-repair runs

### Supabase pg_cron jobs

Live database also contains four active jobs that must be migrated:

- sectionx-arbiter-pull: 0 2,11,15,19,23 * * *
- sectionx-arbiter-rosters: 30 12 * * *
- sectionx-fan-alert-dispatch: */5 * * * *
- sectionx-arbiter-roster-watchdog: */30 * * * *

Target:

- Cloudflare Cron Triggers for schedules
- Queues/Workflows for long, retryable or fan-out jobs
- no scheduler should depend on a public HTTP route calling back into the same application unless there is a specific reason

## Current production reliability baseline

Vercel runtime errors over the prior seven days at audit time included:

- 66 fetch/network failures across public routes, consistent with the cost/reliability penalty of server code making remote HTTP database calls
- 5 Arbiter roster automation executions hitting Vercel's 120-second timeout
- Arbiter health status persistence errors
- upstream Arbiter 502/Gateway Timeout events
- an occasional ECONNRESET
- one invalid date rendering error on scores

Migration requirements derived from this baseline:

1. D1 access should be through a Worker binding, not a remote public database HTTP API.
2. Long Arbiter work must be decomposed into retryable queue/workflow units rather than one large request.
3. Upstream Arbiter 5xx/network failures require bounded retry/backoff and idempotent writes.
4. Existing data integrity/freshness protections must survive retries.

## Target architecture

```text
GitHub
  |
  v
Cloudflare Workers Builds
  |-- non-production branch -> preview version / preview URL
  `-- main -> production deploy

Cloudflare Worker / web application
  |
  |-- Application services (portable TypeScript)
  |-- Repositories (portable interfaces)
  |-- Auth service (portable interface)
  |-- Asset store (portable interface)
  |-- Arbiter adapter (portable interface)
  |
  |-- D1 adapter
  |-- R2 adapter
  |-- Cloudflare Queue/Cron adapter
  `-- Worker secrets
```

## Portability rules going forward

1. Feature/page code must not import D1, R2, Wrangler or Cloudflare bindings directly.
2. Feature/page code must not import Supabase directly after refactor.
3. Domain/business logic remains ordinary TypeScript.
4. All persistence goes through repository/service interfaces.
5. All file operations go through AssetStore.
6. All authentication/identity checks go through AuthService/ContributorIdentity.
7. All external Arbiter calls go through the Arbiter client/service boundary.
8. Scheduled jobs invoke application services; application services do not know which scheduler launched them.
9. Secrets are injected at runtime and never committed.
10. Database migrations live in Git.
11. Production and preview environments use separate resources/secrets where needed.
12. Preserve stable HTTP/API contracts unless an intentional versioned change is approved.

## Framework migration decision

Current app: Next.js 14.2.

Cloudflare's current recommended Next.js-on-Workers path is vinext. vinext is beta and the current existing-app migration documentation centers on Next.js 16. Therefore do not blindly initialize vinext against production Next 14.

Migration sequence:

1. bring current Next.js application forward on the migration branch, preserving behavior
2. run framework compatibility checks
3. initialize vinext non-destructively if compatible
4. retain OpenNext as a fallback if a vinext compatibility gap blocks parity
5. do not change production routing until the Cloudflare preview passes the parity suite

Long-term, keep application/domain code portable enough that a future move from Next/vinext to plain Vite/React Router or another TypeScript web framework does not require rewriting sports logic or persistence logic.

## CI/CD requirement — one-button workflow

The target development workflow is Cloudflare Workers Builds connected directly to GitHub:

- main is production
- feature/migration branches produce Cloudflare preview builds
- a push from ChatGPT/GitHub automatically triggers a Cloudflare build
- preview deployment status/URL is surfaced through GitHub checks/comments where supported
- after deployment, preview URLs can be browser-tested before merge

This recreates the useful Vercel workflow: code push -> automatic preview -> visual verification -> production promotion, without needing a human to manually deploy each change.

A one-time Cloudflare account action is expected to connect the GitHub repository/create the Worker and authorize the required Cloudflare resources. Prefer Cloudflare's Git integration over a permanent broad API token. If an API token is needed for migration/bootstrap, use a temporary scoped token and revoke it afterward.

## Proposed Cloudflare resources

- Worker: sectionxscoreboard web/API
- D1 production database
- D1 preview/dev database
- R2 production bucket for user/admin media
- R2 preview/dev bucket
- Queue(s) for Arbiter roster/schedule processing and fan-alert delivery where appropriate
- Cron triggers matching current Vercel + Supabase schedules
- Worker secrets for admin, Arbiter and email provider credentials
- custom domain routing for www.sectionxscoreboard.com and apex redirect
- stable asset hostname backed by R2/Worker

## Migration order

### Stage 0 — safety

- migration branch exists: cloudflare-migration
- production main remains untouched
- record production parity baseline
- keep Vercel and Supabase active throughout migration and early cutover

### Stage 1 — portability refactor on current stack

- introduce repository/service boundaries
- replace feature-level direct Supabase mutations/reads with those boundaries
- keep Supabase adapter as the first implementation so behavior can be regression-tested before D1 is involved
- isolate storage and contributor auth
- move database-trigger business rules into services while retaining Postgres guards until cutover

### Stage 2 — Cloudflare-compatible runtime

- update Next.js safely
- run vinext compatibility check
- add Cloudflare configuration/build scripts
- create preview Worker via Git integration
- preserve redirects, headers, metadata, routes and image behavior

### Stage 3 — D1/R2 implementations

- build D1 schema/migrations
- build data export/transform/import tooling
- implement D1 repositories
- implement R2 AssetStore
- implement contributor auth on D1
- migrate current objects to R2

### Stage 4 — automation

- migrate Vercel and Supabase schedules to Cron Triggers
- decompose Arbiter roster/schedule work into retryable units
- migrate fan alert dispatch
- preserve dedupe, freshness and integrity semantics

### Stage 5 — parity / shadow validation

- deploy Cloudflare preview
- load migrated production snapshot
- verify page/API/admin behavior against production
- run Arbiter dry-run/health behavior without allowing the preview environment to double-write or double-send alerts
- verify storage upload/delete and contributor auth separately

### Stage 6 — cutover

- temporarily freeze or dual-write mutable paths for final synchronization
- take final Supabase delta export
- import/validate D1 delta
- migrate any final R2 objects
- switch domain routing to Cloudflare
- smoke test immediately
- retain Vercel + Supabase unchanged as rollback targets

### Stage 7 — decommission

Only after stable production verification:

- disable old Supabase pg_cron jobs first
- disable Vercel cron/deployment traffic
- retain database backup/export
- cancel Vercel Pro
- downgrade/cancel Supabase after rollback window
- revoke temporary migration credentials

## Cutover invariants

Do not switch production unless all are true:

- production snapshot and final delta row counts reconcile
- all IDs and foreign-key references are preserved
- scores/standings match production for sampled and automated cases
- result_exempt / postponement / cancellation behavior matches
- Arbiter links and exception resolutions are preserved
- roster freshness/publication behavior matches
- admin login and all admin mutation paths work
- photo/logo upload and delete work on R2
- contributor signup/login/session/permissions work
- fan events are deduplicated and alerts do not double-send
- cron schedules are installed but old/new automation cannot race each other
- www/apex redirect and security headers match
- production custom domain has a tested rollback path

## Known migration risks

High:

- direct Supabase access spread across server/admin/public code
- Postgres trigger/RPC behavior that can be accidentally lost
- long Arbiter roster automation currently timing out
- contributor auth replacement/session migration
- avoiding duplicate scheduled jobs or notifications during overlap

Medium:

- Next 14 -> newer Next/vinext compatibility
- Postgres JSON/array/interval semantics
- public asset URL migration
- analytics query translation/time-zone semantics

Low:

- raw data volume
- R2 storage volume
- admin session mechanism
- Arbiter HTTP client portability
- ordinary React/TypeScript UI

## Definition of migration-ready

The codebase is migration-ready when:

- no feature code depends directly on Supabase
- provider interfaces have both legacy Supabase and Cloudflare implementations where needed for transition
- all Postgres business-rule functions/triggers are represented and tested in application code
- D1 schema/migrations can reproduce current production data and constraints
- R2 migration tooling can reproduce all 81 current objects and stable URLs
- contributor auth replacement is functional
- all current Vercel and Supabase schedules exist in the Cloudflare configuration
- a Git push creates a Cloudflare preview automatically
- the parity checklist passes on preview
- cutover/final-sync/rollback procedures are scripted or documented and rehearsed
