import { describe, expect, it } from 'vitest'
import type { DashboardCounts } from '../selectors/subscriptions'
import {
  getDashboardActionHref,
  getFirstPendingDashboardActionHref,
} from '../utils/dashboardActions'

function counts(overrides: Partial<DashboardCounts> = {}): DashboardCounts {
  return {
    needsReview: 0,
    expiringSoon: 0,
    upcomingCharges: 0,
    cancellationTasks: 0,
    ...overrides,
  }
}

describe('Dashboard action routing', () => {
  it('uses the existing Action Card href for each dashboard action filter', () => {
    expect(getDashboardActionHref('needs_review')).toBe('/subscriptions?filter=needs_review')
    expect(getDashboardActionHref('expiring_soon')).toBe('/subscriptions?filter=expiring_soon')
    expect(getDashboardActionHref('upcoming_charges')).toBe('/subscriptions?filter=upcoming_charges')
    expect(getDashboardActionHref('cancellation_tasks')).toBe(
      '/subscriptions?filter=cancellation_tasks',
    )
  })

  it('routes to Expiring Soon when it is the only non-zero action category', () => {
    expect(getFirstPendingDashboardActionHref(counts({ expiringSoon: 1 }))).toBe(
      '/subscriptions?filter=expiring_soon',
    )
  })

  it('routes to Needs Review when it is the only non-zero action category', () => {
    expect(getFirstPendingDashboardActionHref(counts({ needsReview: 1 }))).toBe(
      '/subscriptions?filter=needs_review',
    )
  })

  it('uses the confirmed priority when multiple action categories are non-zero', () => {
    expect(
      getFirstPendingDashboardActionHref(
        counts({
          needsReview: 2,
          expiringSoon: 1,
          upcomingCharges: 1,
          cancellationTasks: 1,
        }),
      ),
    ).toBe('/subscriptions?filter=needs_review')
  })

  it('returns no CTA target when there are no pending actions', () => {
    expect(getFirstPendingDashboardActionHref(counts())).toBeNull()
  })
})
