# Fan Experience 2.0

Current fan platform direction: **Follow → Live → Discover → Remember**.

## Shipped foundation
- Universal search across schools, teams and athletes.
- Athlete follows with email preferences and no required account.
- Team follows available contextually on team pages and inside Game Center.
- Follow submissions are private and written server-side with service-role access only.
- Existing school final-score alert subscriptions are reused for compatible team follows.
- Explicit Game Center live state comes from game data, not DOM text; live pages refresh every 20 seconds while visible.
- Roster publication intelligence keeps unverified active-season Arbiter rosters hidden while retaining source rows for audit.
- Fall Operations shows roster-publication and fan-follow intelligence without exposing subscriber emails.

## Delivery truth
Final-score team follows can feed the existing school score-alert subscription list. Schedule-change, live-update and photo preferences are stored now, but an outbound dispatcher for those channels is not yet implemented. UI copy must not promise delivery until that pipeline exists.

## Next logical fan work
- Notification dispatcher + unsubscribe/preferences management.
- Calendar/ICS follows.
- Athlete career timeline and deeper photo galleries.
- Public contributor portfolios through a safe server/view boundary.
