function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[.,]/g, '')
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

  return normalizeText(raw)
    .replace(/^stl\s+/, 'st ')
    .replace(/\bhigh school\b/g, 'hs')
    .replace(/\bcentral school\b/g, 'central')
    .replace(/\s+/g, ' ')
    .trim()
}

export function arbiterLocationsEquivalent(before: unknown, after: unknown): boolean {
  const a = arbiterLocationFingerprint(before)
  const b = arbiterLocationFingerprint(after)
  if (a === b) return true
  if (!a || !b) return a === b

  const shorter = a.length <= b.length ? a : b
  const longer = a.length > b.length ? a : b
  if (shorter.length >= 18 && longer.startsWith(shorter)) {
    const extra = longer.slice(shorter.length).trim()
    if (!extra) return true
    if (/^(?:normal|show details|tournament|none|t\b|mon\b|tue\b|wed\b|thu\b|fri\b|sat\b|sun\b)/i.test(extra)) return true
  }
  return false
}
