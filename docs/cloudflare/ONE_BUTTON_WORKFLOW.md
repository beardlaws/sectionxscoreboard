# Section X Scoreboard — One-Button Cloudflare Workflow

## Goal

Preserve the workflow currently enjoyed with GitHub + Vercel:

1. user asks ChatGPT to make a change
2. ChatGPT edits/pushes code in GitHub
3. hosting platform automatically builds a preview
4. ChatGPT can inspect/test the deployed preview
5. only a verified change is promoted to production

No manual Cloudflare deploy should be required for ordinary future feature work.

## Preferred CI/CD design

Use Cloudflare Workers Builds Git integration rather than a permanent broad Cloudflare API token stored in chat or GitHub.

Repository: beardlaws/sectionxscoreboard

Branches:

- main: production branch
- cloudflare-migration: migration/preview branch until cutover
- future feature/fix branches: preview builds

Cloudflare behavior:

- push to main -> production build/deploy
- push to any enabled non-production branch -> preview version
- GitHub receives build/check status and preview information where supported

## One-time owner setup

The account owner must authorize Cloudflare's GitHub integration because ChatGPT's current connected tools do not expose direct Cloudflare account administration.

In Cloudflare:

1. Workers & Pages -> Create application
2. Import a repository
3. connect GitHub if not already connected
4. select beardlaws/sectionxscoreboard
5. production branch: main
6. enable preview builds for non-production branches
7. initially do NOT move sectionxscoreboard.com or www.sectionxscoreboard.com
8. keep production scheduled/mutating automation disabled on preview

During framework bootstrap, allow the migration branch to establish the actual Worker/Wrangler/vinext configuration before the production domain is attached.

## Secrets / bindings model

Do not commit secret values.

Production secrets expected:

- ADMIN_PASSWORD
- ADMIN_SESSION_TOKEN
- ARBITER_CLIENT_ID
- ARBITER_CLIENT_SECRET
- optional ARBITER_TOKEN_URL
- optional ARBITER_API_BASE_URL
- optional ARBITER_SCOPE
- RESEND_API_KEY or BREVO_API_KEY
- FAN_ALERTS_FROM

Temporary transition-only secrets may include Supabase credentials while the migration branch still uses the legacy database. Remove them once D1 parity is complete.

Cloudflare resource bindings expected:

- DB -> production D1 database
- MEDIA -> production R2 bucket
- one or more Queue producer/consumer bindings for long Arbiter/fan-alert jobs

Preview bindings must point to preview resources, not production D1/R2/Queues.

## ChatGPT operating model after setup

For ordinary feature/fix work:

1. inspect current main and relevant production state
2. create/update a feature branch
3. make code changes
4. push branch
5. Cloudflare automatically creates preview build/version
6. inspect build status
7. open/test preview URL in browser tooling
8. fix until parity/feature checks pass
9. merge/promote only when safe
10. verify production after deployment

For urgent production fixes, the same process should still be used unless the public site is already materially broken and a narrowly scoped direct production fix is safer.

## Migration-specific operating model

While cloudflare-migration exists:

- main remains Vercel/Supabase production
- cloudflare-migration is the only place for Cloudflare runtime migration work
- Cloudflare preview must not run production cron jobs or send production alerts
- Cloudflare preview can use a copied D1/R2 dataset
- production Supabase remains authoritative until final cutover

## Deployment portability

Cloudflare Git integration is deployment automation, not application architecture. The app must remain runnable without it.

Provider-specific code belongs in adapters. Domain code must not import Cloudflare bindings directly. If Section X later leaves Cloudflare, CI/CD changes but the business/application code should remain largely unchanged.

## Credential policy

Preferred:

- Cloudflare GitHub App handles normal deploys
- Cloudflare secrets live in Cloudflare
- no global API key
- no permanent 'god token'

If API/bootstrap access is necessary:

- create a temporary scoped token
- restrict it to the Section X account/resources and required permissions
- use it only for migration/bootstrap
- revoke it after Git integration and resources are established

## Cutover change

At final cutover, Cloudflare production remains wired to main, but the domain moves only after the D1/R2/automation parity checklist passes. Vercel and Supabase stay available as rollback infrastructure for the initial production verification window.
