# Roster Freshness Guardrails

Automated Arbiter roster imports must establish that the incoming roster belongs to the active season before writing it.

`current-verified` means Arbiter supplied an explicit current-season marker. `current-probable` means there is no stale marker and the roster materially differs from the prior season. `awaiting-current-roster`, `possible-prior-season-roster`, `prior-season-roster`, and `review-needed` are held and retried later.

Only verified/probable payloads reach the existing importer. The retroactive audit is deliberately non-destructive: already-imported active-season rosters that are essentially identical to the previous season are flagged for review, not deleted automatically.
