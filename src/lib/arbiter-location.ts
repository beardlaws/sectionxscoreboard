function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripLeadingArbiterMarker(value: string): string {
  return value
    .replace(/^[\s\u00a0\u200b-\u200d\ufeff]*(?:i|l|\|)[\s\u00a0]+(?=[a-z0-9])/i, '')
    .replace(/^[\s\u00a0\u200b-\u200d\ufeff]*(?:i|l|\|)(?=st\.?\s)/i, '')
}

export function cleanArbiterLocation(value: unknown): string {
  return stripLeadingArbiterMarker(String(value ?? ''))
    .replace(/^\s*school\s+/i, '')
    .replace(/^\s*stl\.?(?=\s)/i, 'St. ')
    .replace(/\s+normal(?:\s+[a-z])?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function semanticVenueFingerprint(value: unknown): string {
  return normalizeText(value)
    .replace(/\bjunior senior high school\b/g, 'jr sr hs')
    .replace(/\bjunior high school\b/g, 'jhs')
    .replace(/\bmiddle school\b/g, 'ms')
    .replace(/\belementary school\b/g, 'elem')
    .replace(/\bhigh school\b/g, 'hs')
    .replace(/\bcentral school district\b/g, 'central')
    .replace(/\bcentral school\b/g, 'central')
    .replace(/\bcsd\b/g, 'central')
    .replace(/\bgymnasium\b/g, 'gym')
    .replace(/\bmain gym\b/g, 'gym')
    .replace(/\bathletic fields?\b/g, 'field')
    .replace(/\bsoccer pitch\b/g, 'soccer field')
    .replace(/\bfootball stadium\b/g, 'football field')
    .replace(/\bbaseball diamond\b/g, 'baseball field')
    .replace(/\bsoftball diamond\b/g, 'softball field')
    .replace(/\bice arena\b/g, 'arena')
    .replace(/\bice rink\b/g, 'rink')
    .replace(/\bswimming pool\b/g, 'pool')
    .replace(/\sauditorium\b/g, ' auditorium')
    .replace(/\s+/g, ' ')
    .trim()
}

export function arbiterLocationFingerprint(value: unknown): string {
  let raw = stripLeadingArbiterMarker(cleanArbiterLocation(value))
    .replace(/\bshow\s+details\b.*$/i, '')
    .replace(/\bnone\s+[a-z]?\s*$/i, '')
    .replace(/\s+normal(?:\s+[a-z])?\b/gi, ' ')
    .replace(/^\s*school\s+/i, '')
    .replace(/^\s*stl\.?(?=\s)/i, 'St. ')
    .replace(/\s+/g, ' ')
    .trim()

  const scheduleNoise = raw.search(/\s+(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i)
  if (scheduleNoise >= 0) raw = raw.slice(0, scheduleNoise).trim()

  return semanticVenueFingerprint(raw)
    .replace(/^stl\s+/, 'st ')
    .replace(/\s+/g, ' ')
    .trim()
}

function genericVenueSuffix(extra: string): boolean {
  return /^(?:main\s+)?(?:gym|field|fields|court|stadium|arena|rink|pool|track|complex|campus|auditorium)(?:\s+(?:field|fields|court|stadium|arena|rink|pool|track|complex))?$/.test(extra)
}

type VenueProfile = {
  anchor: string
  level: string | null
  family: string | null
  sport: string | null
}

function venueProfile(fingerprint: string): VenueProfile {
  const tokens = fingerprint.split(' ').filter(Boolean)
  let level: string | null = null
  if (fingerprint.includes('jr sr hs')) level = 'jr-sr-hs'
  else if (tokens.includes('jhs')) level = 'jhs'
  else if (tokens.includes('ms')) level = 'ms'
  else if (tokens.includes('elem')) level = 'elem'
  else if (tokens.includes('hs')) level = 'hs'

  let family: string | null = null
  let sport: string | null = null
  const sportWords = ['soccer','football','baseball','softball','lacrosse','fieldhockey']
  for (const word of sportWords) if (tokens.includes(word)) sport = word
  if (tokens.includes('gym') || tokens.includes('court') || tokens.includes('auditorium')) family = 'indoor-court'
  else if (tokens.includes('pool')) family = 'pool'
  else if (tokens.includes('rink') || tokens.includes('arena')) family = 'ice'
  else if (tokens.includes('track')) family = 'track'
  else if (tokens.includes('field') || tokens.includes('stadium')) family = 'field'
  else if (tokens.includes('complex') || tokens.includes('campus')) family = 'complex'

  const noise = new Set([
    'central','school','district','academy','campus','complex','main',
    'hs','ms','jhs','elem','jr','sr','high','middle','junior','senior',
    'gym','court','gymnasium','auditorium','field','fields','stadium','arena','rink','pool','track',
    'soccer','football','baseball','softball','lacrosse','fieldhockey','athletic','ice'
  ])
  const anchor = tokens.filter(token => !noise.has(token)).join(' ').trim()
  return { anchor, level, family, sport }
}

function levelsCompatible(a: string | null, b: string | null): boolean {
  if (!a || !b) return true
  if (a === b) return true
  return (a === 'jr-sr-hs' && b === 'hs') || (b === 'jr-sr-hs' && a === 'hs')
}

function facilitiesCompatible(a: VenueProfile, b: VenueProfile): boolean {
  if (!a.family || !b.family) return false
  if (a.family !== b.family) return false
  if (a.family === 'field' && a.sport && b.sport && a.sport !== b.sport) return false
  return true
}

export function arbiterLocationsEquivalent(before: unknown, after: unknown): boolean {
  const a = arbiterLocationFingerprint(before)
  const b = arbiterLocationFingerprint(after)
  if (a === b) return true
  if (!a || !b) return a === b

  const shorter = a.length <= b.length ? a : b
  const longer = a.length > b.length ? a : b
  if (shorter.length >= 8 && longer.startsWith(`${shorter} `)) {
    const extra = longer.slice(shorter.length).trim()
    if (!extra) return true
    if (/^(?:normal|show details|tournament|none|t\b|mon\b|tue\b|wed\b|thu\b|fri\b|sat\b|sun\b)/i.test(extra)) return true
    if (genericVenueSuffix(extra)) return true
  }

  const pa = venueProfile(a)
  const pb = venueProfile(b)
  if (pa.anchor && pb.anchor && pa.anchor === pb.anchor && levelsCompatible(pa.level, pb.level) && facilitiesCompatible(pa, pb)) {
    return true
  }

  return false
}
