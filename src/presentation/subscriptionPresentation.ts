import { DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS, deriveMembershipStatus, getRemainingDays } from '../domain/derived'
import {
  isActiveCancellationTask,
  isFieldEvidenceUnresolved,
  isRecordNeedsReview,
  isUpcomingCharge,
  type SubscriptionSelectorOptions,
} from '../selectors/subscriptions'
import type { CancellationStatus, MembershipStatus, RenewalStatus, SubscriptionRecord } from '../types'

export const DEFAULT_UPCOMING_CHARGE_WINDOW_DAYS = 30

export function getReferenceDate(): string {
  return new Date().toISOString().split('T')[0]
}

export function getSelectorOptions(referenceDate: string): SubscriptionSelectorOptions {
  return {
    referenceDate,
    expiringSoonThresholdDays: DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS,
    upcomingChargeWindowDays: DEFAULT_UPCOMING_CHARGE_WINDOW_DAYS,
  }
}

export function getMembershipStatus(record: SubscriptionRecord, referenceDate: string): MembershipStatus {
  return deriveMembershipStatus(record.facts, {
    referenceDate,
    expiringSoonThresholdDays: DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS,
  })
}

export function getMembershipLabel(status: MembershipStatus): string {
  const labels: Record<MembershipStatus, string> = {
    trial: '试用中',
    active: '有效',
    expiring_soon: '即将到期',
    expired: '已过期',
    unknown: '未知',
  }
  return labels[status]
}

export function getRenewalLabel(status: RenewalStatus): string {
  const labels: Record<RenewalStatus, string> = {
    auto_renew_on: '自动续费中',
    auto_renew_off: '自动续费已关闭',
    manual_renewal: '手动续费',
    not_applicable: '不适用',
    unknown: '未知',
  }
  return labels[status]
}

export function getCancellationIndicator(status: CancellationStatus): string | null {
  const labels: Record<CancellationStatus, string | null> = {
    none: null,
    planned: '已计划取消',
    in_progress: '取消进行中',
    confirmed: '已确认取消',
  }
  return labels[status]
}

export interface NextRelevantDate {
  label: string
  value: string
}

export function getNextRelevantDate(record: SubscriptionRecord, referenceDate: string): NextRelevantDate | null {
  const selectorOptions = getSelectorOptions(referenceDate)
  const membershipStatus = getMembershipStatus(record, referenceDate)

  if (isActiveCancellationTask(record) && record.facts.planned_cancel_date) {
    return {
      label: '计划取消日期',
      value: record.facts.planned_cancel_date,
    }
  }

  if (
    (membershipStatus === 'expiring_soon' ||
      membershipStatus === 'expired' ||
      membershipStatus === 'trial') &&
    record.facts.membership_end_date
  ) {
    return {
      label: membershipStatus === 'expired' ? '已结束' : '会员到期',
      value: record.facts.membership_end_date,
    }
  }

  if (isUpcomingCharge(record, selectorOptions) && record.facts.next_charge_date) {
    return {
      label: '下次扣费',
      value: record.facts.next_charge_date,
    }
  }

  if (record.facts.membership_end_date) {
    return {
      label: '会员到期',
      value: record.facts.membership_end_date,
    }
  }

  if (record.facts.next_charge_date) {
    return {
      label: '下次扣费',
      value: record.facts.next_charge_date,
    }
  }

  return null
}

export function formatRemainingDays(record: SubscriptionRecord, referenceDate: string): string {
  const remaining = getRemainingDays(record.facts, referenceDate)

  if (remaining === null) return '未知'
  if (remaining === 0) return '今天到期'
  if (remaining > 0) return `还剩 ${remaining} 天`
  return `已结束 ${Math.abs(remaining)} 天`
}

export interface EvidenceSummary {
  evidenceRecordCount: number
  extractedFieldCount: number
  unresolvedFieldCount: number
  needsReview: boolean
}

export function summarizeEvidence(record: SubscriptionRecord): EvidenceSummary {
  const extractedFieldCount = record.facts.evidence_records.reduce(
    (count, evidence) => count + evidence.extracted_fields.length,
    0,
  )
  const unresolvedFieldCount = record.facts.evidence_records.reduce(
    (count, evidence) =>
      count + evidence.extracted_fields.filter(isFieldEvidenceUnresolved).length,
    0,
  )

  return {
    evidenceRecordCount: record.facts.evidence_records.length,
    extractedFieldCount,
    unresolvedFieldCount,
    needsReview: isRecordNeedsReview(record),
  }
}
