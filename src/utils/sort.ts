import type { Subscription } from '../types'
import { isWithinDays } from './date'

function urgencyScore(s: Subscription): number {
  if (s.status === 'cancelled') return 100

  if (s.status === 'planned_to_cancel') return 3

  if (s.status === 'active') {
    const isTrial = s.type === 'trial'
    const keyDate = isTrial ? s.trial_end_date : s.renewal_date

    if (!keyDate) return 4

    if (isTrial && isWithinDays(keyDate, 7)) return 1
    if (!isTrial && isWithinDays(keyDate, 7)) return 2
    if (!isTrial && isWithinDays(keyDate, 30)) return 5

    return 6
  }

  return 50
}

export function sortByUrgency(subscriptions: Subscription[]): Subscription[] {
  return [...subscriptions].sort((a, b) => urgencyScore(a) - urgencyScore(b))
}
