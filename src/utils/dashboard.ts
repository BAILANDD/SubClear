import type { Subscription } from '../types'
import { isWithinDays, daysUntil } from './date'

export function getTrialsEndingSoon(subscriptions: Subscription[]): Subscription[] {
  return subscriptions
    .filter(
      (s) =>
        s.type === 'trial' &&
        s.status === 'active' &&
        s.trial_end_date != null &&
        isWithinDays(s.trial_end_date, 7),
    )
    .sort((a, b) => daysUntil(a.trial_end_date!) - daysUntil(b.trial_end_date!))
}

export function getRenewingIn7Days(subscriptions: Subscription[]): Subscription[] {
  return subscriptions
    .filter(
      (s) =>
        s.type === 'paid' &&
        s.status === 'active' &&
        s.renewal_date != null &&
        isWithinDays(s.renewal_date, 7),
    )
    .sort((a, b) => daysUntil(a.renewal_date!) - daysUntil(b.renewal_date!))
}

export function getRenewingIn30Days(subscriptions: Subscription[]): Subscription[] {
  const sevenDayIds = new Set(getRenewingIn7Days(subscriptions).map((s) => s.id))
  return subscriptions
    .filter(
      (s) =>
        s.type === 'paid' &&
        s.status === 'active' &&
        s.renewal_date != null &&
        isWithinDays(s.renewal_date, 30) &&
        !sevenDayIds.has(s.id),
    )
    .sort((a, b) => daysUntil(a.renewal_date!) - daysUntil(b.renewal_date!))
}

export function getPlannedToCancel(subscriptions: Subscription[]): Subscription[] {
  return subscriptions.filter((s) => s.status === 'planned_to_cancel')
}

export function getMissingDateItems(subscriptions: Subscription[]): Subscription[] {
  return subscriptions.filter(
    (s) =>
      s.status === 'active' &&
      (s.type === 'paid' ? !s.renewal_date : !s.trial_end_date),
  )
}
