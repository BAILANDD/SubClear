import { deriveMembershipStatus, getDateOnlyDifference } from '../domain/derived'
import type { FieldEvidence, SubscriptionRecord } from '../types'

export type SubscriptionFilter =
  | 'all'
  | 'needs_review'
  | 'expiring_soon'
  | 'upcoming_charges'
  | 'auto_renew_on'
  | 'cancellation_tasks'
  | 'expired'

export interface SubscriptionSelectorOptions {
  referenceDate: string
  expiringSoonThresholdDays?: number
  upcomingChargeWindowDays: number
}

export interface DashboardCounts {
  needsReview: number
  expiringSoon: number
  upcomingCharges: number
  cancellationTasks: number
}

export function isFieldEvidenceUnresolved(field: FieldEvidence): boolean {
  if (field.review_status === 'confirmed' && field.user_confirmed) {
    return false
  }

  if (
    field.review_status === 'needs_review' ||
    field.review_status === 'missing' ||
    field.review_status === 'conflict'
  ) {
    return true
  }

  if (field.review_status === 'ready' && !field.user_confirmed) {
    return true
  }

  if (
    (field.evidence_type === 'inferred' || field.evidence_type === 'user_edited') &&
    !field.user_confirmed
  ) {
    return true
  }

  return false
}

export function isRecordNeedsReview(record: SubscriptionRecord): boolean {
  return record.facts.evidence_records.some((evidenceRecord) =>
    evidenceRecord.extracted_fields.some(isFieldEvidenceUnresolved),
  )
}

export function selectNeedsReviewRecords(
  records: readonly SubscriptionRecord[],
): SubscriptionRecord[] {
  return records.filter(isRecordNeedsReview)
}

export function isUpcomingCharge(
  record: SubscriptionRecord,
  options: Pick<SubscriptionSelectorOptions, 'referenceDate' | 'upcomingChargeWindowDays'>,
): boolean {
  if (record.facts.renewal_status !== 'auto_renew_on') {
    return false
  }

  const windowDays = normalizeWindowDays(options.upcomingChargeWindowDays)
  if (windowDays === null) {
    return false
  }

  const daysUntilCharge = getDateOnlyDifference(record.facts.next_charge_date, options.referenceDate)
  return daysUntilCharge !== null && daysUntilCharge >= 0 && daysUntilCharge <= windowDays
}

export function selectUpcomingCharges(
  records: readonly SubscriptionRecord[],
  options: Pick<SubscriptionSelectorOptions, 'referenceDate' | 'upcomingChargeWindowDays'>,
): SubscriptionRecord[] {
  return records.filter((record) => isUpcomingCharge(record, options))
}

export function selectAutoRenewOnRecords(
  records: readonly SubscriptionRecord[],
): SubscriptionRecord[] {
  return records.filter((record) => record.facts.renewal_status === 'auto_renew_on')
}

export function isActiveCancellationTask(record: SubscriptionRecord): boolean {
  return (
    record.facts.cancellation_status === 'planned' ||
    record.facts.cancellation_status === 'in_progress'
  )
}

export function selectCancellationTasks(
  records: readonly SubscriptionRecord[],
): SubscriptionRecord[] {
  return records.filter(isActiveCancellationTask)
}

export function selectExpiringSoonRecords(
  records: readonly SubscriptionRecord[],
  options: Pick<SubscriptionSelectorOptions, 'referenceDate' | 'expiringSoonThresholdDays'>,
): SubscriptionRecord[] {
  return records.filter(
    (record) =>
      deriveMembershipStatus(record.facts, {
        referenceDate: options.referenceDate,
        expiringSoonThresholdDays: options.expiringSoonThresholdDays,
      }) === 'expiring_soon',
  )
}

export function selectExpiredRecords(
  records: readonly SubscriptionRecord[],
  options: Pick<SubscriptionSelectorOptions, 'referenceDate' | 'expiringSoonThresholdDays'>,
): SubscriptionRecord[] {
  return records.filter(
    (record) =>
      deriveMembershipStatus(record.facts, {
        referenceDate: options.referenceDate,
        expiringSoonThresholdDays: options.expiringSoonThresholdDays,
      }) === 'expired',
  )
}

export function deriveDashboardCounts(
  records: readonly SubscriptionRecord[],
  options: SubscriptionSelectorOptions,
): DashboardCounts {
  return {
    needsReview: selectNeedsReviewRecords(records).length,
    expiringSoon: selectExpiringSoonRecords(records, options).length,
    upcomingCharges: selectUpcomingCharges(records, options).length,
    cancellationTasks: selectCancellationTasks(records).length,
  }
}

export function filterSubscriptionRecords(
  records: readonly SubscriptionRecord[],
  filter: SubscriptionFilter,
  options: SubscriptionSelectorOptions,
): SubscriptionRecord[] {
  switch (filter) {
    case 'all':
      return [...records]
    case 'needs_review':
      return selectNeedsReviewRecords(records)
    case 'expiring_soon':
      return selectExpiringSoonRecords(records, options)
    case 'upcoming_charges':
      return selectUpcomingCharges(records, options)
    case 'auto_renew_on':
      return selectAutoRenewOnRecords(records)
    case 'cancellation_tasks':
      return selectCancellationTasks(records)
    case 'expired':
      return selectExpiredRecords(records, options)
  }
}

function normalizeWindowDays(windowDays: number): number | null {
  if (!Number.isFinite(windowDays) || windowDays < 0) {
    return null
  }

  return Math.floor(windowDays)
}
