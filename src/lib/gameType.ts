export type ContestType = 'Game' | 'Scrimmage'

export function isScrimmage(game: any): boolean {
  if (!game) return false
  if (String(game.contest_type || '').toLowerCase() === 'scrimmage') return true
  return String(game.notes || '').toLowerCase().includes('arbiter type: scrimmage')
}

export function countsAsOfficialResult(game: any): boolean {
  return !isScrimmage(game) && String(game?.status || '').toLowerCase() === 'final'
}

export function contestLabel(game: any): string {
  return isScrimmage(game) ? 'Scrimmage' : 'Game'
}

export function displayStatus(game: any): string {
  const status = String(game?.status || 'Scheduled').trim().toLowerCase()

  if (isScrimmage(game)) {
    if (status === 'postponed') return 'Postponed Scrimmage'
    if (status === 'canceled' || status === 'cancelled') return 'Canceled Scrimmage'
    return 'Scrimmage'
  }

  if (status === 'final') return 'Final'
  if (status === 'live' || status === 'in progress') return 'Live'
  if (status === 'postponed') return 'Postponed'
  if (status === 'canceled' || status === 'cancelled') return 'Canceled'
  return 'Scheduled'
}
