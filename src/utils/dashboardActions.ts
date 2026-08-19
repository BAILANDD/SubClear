import type { DashboardCounts, SubscriptionFilter } from '../selectors/subscriptions'

export type DashboardActionFilter = Exclude<
  SubscriptionFilter,
  'all' | 'auto_renew_on' | 'expired'
>

const DASHBOARD_ACTION_PRIORITY: {
  filter: DashboardActionFilter
  countKey: keyof DashboardCounts
}[] = [
  { filter: 'needs_review', countKey: 'needsReview' },
  { filter: 'expiring_soon', countKey: 'expiringSoon' },
  { filter: 'upcoming_charges', countKey: 'upcomingCharges' },
  { filter: 'cancellation_tasks', countKey: 'cancellationTasks' },
]

export function getDashboardActionHref(filter: DashboardActionFilter): string {
  return `/subscriptions?filter=${filter}`
}

export function getFirstPendingDashboardActionFilter(
  counts: DashboardCounts,
): DashboardActionFilter | null {
  return DASHBOARD_ACTION_PRIORITY.find((action) => counts[action.countKey] > 0)?.filter ?? null
}

export function getFirstPendingDashboardActionHref(counts: DashboardCounts): string | null {
  const filter = getFirstPendingDashboardActionFilter(counts)
  return filter ? getDashboardActionHref(filter) : null
}
