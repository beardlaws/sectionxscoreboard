# Connected Photo Network

Existing `photos` already supports `school_id`, `team_id`, `game_id`, `sport_id`, approval, featured status, caption, and photographer credit. Game Center v1 keeps that table and adds only athlete tagging through `photo_athletes`.

## Submission behavior
- Generic photo submission remains supported.
- `/submit-photo?game=<game id>` preselects the matchup and sport.
- Submitters may identify a school in the matchup; the form stores the matching team when possible.
- Approval remains required before public display.

## Distribution target
An approved connected photo can later surface on:
- Game Center
- Team gallery
- School hub/gallery
- Sport gallery
- Athlete profile/gallery when tagged
- Sitewide latest/featured photos

## Moderation principle
Connections do not bypass approval. Athlete tags should be admin/trusted-contributor moderated before they are used broadly.
