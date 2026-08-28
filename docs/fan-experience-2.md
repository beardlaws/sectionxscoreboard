# Fan Experience 2.0

## Live foundation
- Universal school/team/athlete search
- Team and athlete follows without requiring accounts
- Explicit Game Center live-state refresh
- Roster publication intelligence and fan follow intelligence
- Public roster quarantine for unverified active-season Arbiter data

## Fan alert delivery package
- Private per-follow management tokens
- `/following?token=...` preference/unsubscribe center
- Event queue for finals, live starts, schedule changes and approved photos
- Per-follow delivery audit table
- Provider abstraction supporting Resend or Brevo through environment variables
- Guarded `/api/cron/fan-alerts` dispatcher authenticated with the existing Section X automation key
- Supabase 5-minute scheduler trigger
- Team iCalendar feed at `/api/calendar/team/[id]`
- Team pages surface Add Calendar through the contextual fan bar
- Game Center follow buttons identify the team by name

Email sending is intentionally fail-closed: the queue can be installed before a provider key exists, but no outbound mail is attempted until `RESEND_API_KEY` or `BREVO_API_KEY` is configured.
