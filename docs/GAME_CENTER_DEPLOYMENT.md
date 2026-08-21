# Deployment sequence

1. Additive database migration and RLS.
2. Seed initial stat definitions.
3. Deploy game-aware photo submission on a preview branch.
4. Verify Next.js build and public form behavior.
5. Merge user-facing photo connection only after preview is Ready.
6. Integrate advanced Game Center sections separately so existing game pages are never held hostage by unfinished stats UI.
