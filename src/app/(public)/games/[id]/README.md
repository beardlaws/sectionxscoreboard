# Game Center page integration

`GameCenterSections` is the single drop-in component for the existing game detail page. It is intentionally isolated so the current score/recap/gallery experience is not destabilized while the new database foundation ships.

When integrating into `page.tsx`, import:

```tsx
import GameCenterSections from './GameCenterSections'
```

Then render before the existing game-photo gallery:

```tsx
<GameCenterSections gameId={game.id} awayName={awayName} homeName={homeName} />
```

All stat/scoring modules render nothing when no advanced data exists. The photo CTA always renders and deep-links to `/submit-photo?game=<id>`.
