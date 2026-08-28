# Roster Freshness Guardrails

Automated Arbiter roster imports must establish that the incoming roster belongs to the active season before writing it.

## Verification policy

The v3 worker uses **roster-local** season provenance. It finds the actual roster array and only inspects primitive season fields on that roster container and its nearby ancestors. It does not recursively scan sibling/history objects, because Arbiter responses can contain several school years at once.

For Fall 2026, `2026-27` or an equivalent school-year-ending-2027 marker beside the roster can verify it. `2025-26` / school-year-ending-2026 is prior-season evidence. Conflicting or missing roster-local provenance is held.

Statuses:
- `current-verified`: roster-local metadata unambiguously identifies the active school year.
- `awaiting-current-roster`: Arbiter returned no non-empty roster.
- `prior-season-roster`: roster-local metadata identifies the prior school year.
- `possible-prior-season-roster`: comparison strongly suggests carryover from the prior season.
- `review-needed`: provenance is missing or conflicting.

Only `current-verified` payloads reach the importer.

## Public visibility

Existing rows are never deleted merely because provenance is uncertain. Active-season rows with `source='arbiter'` are hidden from anon/authenticated reads unless `arbiter_roster_freshness` says the team/season is `current-verified`. Historical rows and non-Arbiter/manual rows remain readable under the normal policies.

The same visibility rule applies to Arbiter coaches because they come from the same team payload.

## Write backstop

Database triggers block active-season Arbiter roster/coach inserts or updates unless the matching freshness row is `current-verified`. This prevents an older importer or accidental direct write from bypassing the guarded worker. Service-role/admin diagnostics remain available without deleting source data.

`arbiter_roster_publication_status_admin` provides a service-role-only operational view showing freshness state, current Arbiter row counts, and whether each active team is publicly visible.
