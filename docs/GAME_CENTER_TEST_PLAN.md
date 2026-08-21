# Game Center v1 test plan

Before merge:
- Vercel preview must be Ready.
- `/submit-photo` renders without a game query.
- `/submit-photo?game=<valid game id>` preselects a matchup and sport.
- Existing game pages continue to render.
- Existing photo queue remains unchanged.
- Existing team/school/schedule/standings pages remain unchanged.

After future GameCenterSections integration:
- Score-only game shows no empty stat tables.
- Period scoring renders in order.
- Team stats render away/home values correctly.
- Athlete stats link to athlete profiles when slug exists.
- Game photo CTA deep-links to the correct game.
