export const SECTION_X_TIME_ZONE = 'America/New_York'

function partsFor(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SECTION_X_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || ''
  return { year: get('year'), month: get('month'), day: get('day') }
}

export function sectionXDate(date: Date = new Date()) {
  const { year, month, day } = partsFor(date)
  return `${year}-${month}-${day}`
}

export function sectionXDateOffset(offsetDays: number, date: Date = new Date()) {
  const { year, month, day } = partsFor(date)
  const noonUtc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + offsetDays, 12))
  const shifted = partsFor(noonUtc)
  return `${shifted.year}-${shifted.month}-${shifted.day}`
}

export function sectionXLongDate(date: Date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: SECTION_X_TIME_ZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}
