// Human-readable catalog for future Game Center admin work.
// The database remains the source of truth; this file documents the intended breadth.
export const GAME_CENTER_STAT_CATEGORIES = {
  basketball: ['Scoring', 'Rebounding', 'Playmaking', 'Defense', 'Shooting'],
  soccer: ['Scoring', 'Goalkeeping', 'Discipline'],
  football: ['Passing', 'Rushing', 'Receiving', 'Defense', 'Kicking'],
  hockey: ['Scoring', 'Goalkeeping', 'Special Teams'],
  lacrosse: ['Scoring', 'Goalkeeping', 'Faceoffs'],
  baseball_softball: ['Batting', 'Pitching', 'Fielding'],
  volleyball: ['Attacking', 'Serving', 'Blocking', 'Defense'],
  wrestling: ['Record', 'Pins', 'Points', 'Weight Class'],
  track_swimming: ['Event', 'Time', 'Distance', 'Place', 'Personal Record'],
  golf: ['Score', 'Place'],
} as const
