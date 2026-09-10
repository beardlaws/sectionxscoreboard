# Section X Scoreboard — Cloudflare Parity Checklist

This checklist is the gate between a Cloudflare preview and production cutover. A migration is not successful merely because the homepage loads.

## Deployment workflow

- [ ] GitHub push to non-production branch triggers Cloudflare preview build
- [ ] Preview URL is available without changing production DNS
- [ ] Build/deploy status is visible from GitHub
- [ ] main is the only automatic production branch
- [ ] preview environment cannot send production fan alerts or run production-mutating scheduled jobs
- [ ] rollback deployment/routing procedure is documented and tested

## Global / infrastructure

- [ ] www.sectionxscoreboard.com is canonical
- [ ] apex redirects to www with path/query preserved
- [ ] HTTPS valid
- [ ] security headers match or improve current production
- [ ] robots/sitemap/metadata behavior preserved
- [ ] 404/not-found behavior preserved
- [ ] static assets load
- [ ] remote/R2 images render correctly
- [ ] mobile viewport/navigation works
- [ ] no Supabase browser credential remains in production front-end bundle

## Homepage

- [ ] current/today games are correct
- [ ] postponed/canceled/exempt contests display correctly
- [ ] scores and statuses match production
- [ ] sponsor placements render
- [ ] featured content/weekly recap renders
- [ ] links route correctly

## Scores

- [ ] scores page loads
- [ ] date navigation works
- [ ] final/live/scheduled/postponed/canceled states match
- [ ] result_exempt games do not appear as missing-score obligations where they should not
- [ ] game links work
- [ ] malformed/empty game times do not crash rendering

## Standings / rankings

- [ ] standings match production for every active fall sport/class/division
- [ ] league/non-league designation logic matches
- [ ] manual league overrides match
- [ ] scrimmages are excluded/handled identically
- [ ] BTM calculations match expected production outputs
- [ ] staff power ranking snapshots render
- [ ] fan ranking snapshots/ballots behave correctly

## Games / Game Center

- [ ] game detail loads
- [ ] Game Center loads
- [ ] home/away/external opponents resolve correctly
- [ ] period scores render
- [ ] athlete/team stats render
- [ ] recap content renders
- [ ] Game Center photo behavior works
- [ ] schedule changes reflect correctly
- [ ] playoff links/metadata work

## Schools / teams / athletes

- [ ] schools index loads
- [ ] all 24 Section X school pages sampled/automated
- [ ] logos load from new asset host
- [ ] team pages load
- [ ] rosters obey freshness visibility rules
- [ ] coach visibility obeys same rules
- [ ] athlete pages load
- [ ] roster/coach associations preserved

## Cross country

- [ ] XC sports page loads
- [ ] meet pages load
- [ ] team results match
- [ ] dual results match
- [ ] individual finish-time representation/formatting is correct
- [ ] Arbiter XC schedule sync preserves classification and dedupe logic

## Playoffs

- [ ] tournament list loads
- [ ] brackets/tournament pages load
- [ ] linked games preserve IDs/relationships
- [ ] playoff score/status propagation matches production

## Search

- [ ] search route loads
- [ ] schools/teams/athletes/content are discoverable as before
- [ ] no material result regression from database migration

## Photos / R2

- [ ] all migrated objects exist
- [ ] database photo URLs resolve
- [ ] school logo URLs resolve
- [ ] public photo submission uploads successfully
- [ ] failed DB insert cleans uploaded object when appropriate
- [ ] admin delete removes both object and row as intended
- [ ] Game Center cleanup removes correct objects only
- [ ] approval status works
- [ ] athlete photo tags work
- [ ] photo approval enqueues at most one deduplicated fan event

## Admin authentication

- [ ] /admin/login works
- [ ] invalid password rejected
- [ ] valid login creates secure session cookie
- [ ] /admin/* denied without session
- [ ] /api/admin/* denied without session
- [ ] logout invalidates/removes session
- [ ] session expiration behavior preserved

## Admin — operational parity

- [ ] quick score works
- [ ] game create/update/delete works
- [ ] postpone/cancel flows work
- [ ] result exemption works
- [ ] schedule override works
- [ ] league designation override works
- [ ] recaps work
- [ ] standings-affecting writes recalculate/display correctly
- [ ] seasons/settings work
- [ ] sponsors work
- [ ] sponsor analytics works
- [ ] traffic analytics works
- [ ] submissions/corrections moderation works
- [ ] spotlight/weekly recap content works
- [ ] athlete/team/school management works
- [ ] photo moderation works
- [ ] contributor moderation works
- [ ] playoff admin works
- [ ] fan-zone admin works
- [ ] cross-country admin works

## Contributor authentication / authorization

- [ ] existing contributor identities are preserved or migrated via controlled reset/invite
- [ ] signup works
- [ ] login works
- [ ] logout works
- [ ] session refresh works
- [ ] contributor can read own profile
- [ ] contributor cannot read another contributor's private data
- [ ] pending/suspended/rejected states enforced
- [ ] approved contributor permissions enforced
- [ ] score submission works
- [ ] coverage claim works
- [ ] photo submission/tagging permissions work
- [ ] unauthorized API calls return 401/403 correctly

## Fan Zone / follows / notifications

- [ ] team/athlete follows work
- [ ] manage-token flow works
- [ ] fan game voting works
- [ ] school support voting works
- [ ] power ranking ballots work
- [ ] top-play nominations work
- [ ] final game event dedupe works
- [ ] live event dedupe works
- [ ] schedule-change event dedupe works
- [ ] photo event dedupe works
- [ ] email provider integration works
- [ ] no duplicate delivery occurs during migration overlap

## Arbiter API

- [ ] OAuth token retrieval works from Workers
- [ ] token caching behavior is safe
- [ ] identity/groups/schools/sports/levels/teams endpoints work
- [ ] games endpoint works
- [ ] deleted-games endpoint works
- [ ] roster endpoint works
- [ ] upstream 5xx/timeout retry policy is bounded
- [ ] rate/error handling does not corrupt local state

## Arbiter schedule automation

- [ ] school mappings preserved
- [ ] team mappings preserved
- [ ] stable game links preserved
- [ ] shared event IDs preserved
- [ ] exception resolutions preserved
- [ ] manual schedule overrides preserved
- [ ] source payload/audit history preserved
- [ ] create/update/delete reconciliation matches current behavior
- [ ] scrimmages preserve integrity rule
- [ ] external-only events remain handled correctly
- [ ] health checks store valid statuses
- [ ] scheduled pulls run at intended local/UTC equivalents

## Arbiter roster automation

- [ ] stable team links preserved
- [ ] current academic-year classification matches existing logic
- [ ] possible stale carryover is blocked
- [ ] verified current rosters publish
- [ ] unverified current-season Arbiter rows remain hidden
- [ ] previous/historical seasons remain visible where expected
- [ ] coach writes use the same freshness gate
- [ ] stale run recovery works
- [ ] long jobs do not depend on one HTTP request surviving >120 seconds
- [ ] retry is idempotent

## Analytics / sponsors

- [ ] sponsor served impression tracking works
- [ ] viewable impression tracking works
- [ ] sponsor click tracking works
- [ ] admin sponsor rollups reconcile with production for same period
- [ ] traffic events ignore bots/admin as intended
- [ ] today/yesterday/7d/30d totals reconcile
- [ ] top pages/referrers/content/device/campaign summaries reconcile
- [ ] America/New_York day boundaries are correct
- [ ] preview traffic cannot contaminate production analytics

## Data migration reconciliation

For every table:

- [ ] source row count recorded immediately before final export
- [ ] destination row count matches expected value
- [ ] primary-key uniqueness validated
- [ ] required foreign-key references validate
- [ ] representative JSON fields round-trip
- [ ] booleans round-trip
- [ ] timestamps round-trip
- [ ] numeric fields round-trip
- [ ] array-as-JSON field round-trips
- [ ] XC interval conversion round-trips

High-value explicit checks:

- [ ] 24 schools
- [ ] 23 sports at audit baseline unless production changed
- [ ] team IDs/slugs preserved
- [ ] all current games and Arbiter links preserved
- [ ] athletes/rosters/coaches preserved
- [ ] active season preserved
- [ ] result_exempt fields preserved
- [ ] league/schedule overrides preserved
- [ ] sponsor/traffic history preserved
- [ ] contributor profile/user relationships preserved

## Automation cutover safety

Before DNS switch:

- [ ] Cloudflare scheduled handlers configured
- [ ] Cloudflare production schedules initially disabled or mutation-gated
- [ ] old Supabase pg_cron remains active while Vercel/Supabase is production
- [ ] old Vercel cron remains active while Vercel/Supabase is production

At cutover:

- [ ] stop/disable old mutating scheduled jobs in controlled order
- [ ] final delta sync runs
- [ ] D1 validation passes
- [ ] enable Cloudflare schedules
- [ ] switch domain routing
- [ ] smoke test public + admin

After cutover:

- [ ] verify first Arbiter schedule run
- [ ] verify first roster run
- [ ] verify first fan alert dispatch
- [ ] verify watchdog/recovery behavior
- [ ] verify analytics ingestion
- [ ] verify uploads
- [ ] monitor errors without deleting rollback infrastructure

## Rollback trigger examples

Rollback rather than debugging live if any of these occurs immediately after cutover:

- core scores/standings unavailable or materially wrong
- admin cannot enter/update scores
- D1 writes are corrupting relationships
- widespread authentication failure
- widespread image/storage failure
- Arbiter automation creates destructive or duplicate mutations
- fan alerts double-send
- domain/routing failure cannot be resolved quickly through configuration

Rollback means route traffic back to the known-good Vercel production and ensure old Supabase/Vercel automation is in the correct active state before resuming public writes.
