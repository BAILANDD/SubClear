import type { MembershipStatus, SubscriptionFacts } from '../types'

export const DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface MembershipStatusOptions {
  referenceDate: string
  expiringSoonThresholdDays?: number
}

export function getRemainingDays(
  facts: Pick<SubscriptionFacts, 'membership_end_date'>,
  referenceDate: string,
): number | null {
  return getDateOnlyDifference(facts.membership_end_date, referenceDate)
}

export function deriveMembershipStatus(
  facts: Pick<SubscriptionFacts, 'entitlement_type' | 'membership_end_date'>,
  options: MembershipStatusOptions,
): MembershipStatus {
  const remainingDays = getDateOnlyDifference(facts.membership_end_date, options.referenceDate)
  if (remainingDays === null) {
    return 'unknown'
  }

  if (remainingDays < 0) {
    return 'expired'
  }

  const threshold = normalizeThreshold(options.expiringSoonThresholdDays)
  if (remainingDays <= threshold) {
    return 'expiring_soon'
  }

  if (facts.entitlement_type === 'trial') {
    return 'trial'
  }

  return 'active'
}

export function getDateOnlyDifference(
  targetDate: string | null | undefined,
  referenceDate: string,
): number | null {
  const target = parseDateOnly(targetDate)
  const reference = parseDateOnly(referenceDate)

  if (!target || !reference) {
    return null
  }

  return Math.round((target.utcDay - reference.utcDay) / MS_PER_DAY)
}

function normalizeThreshold(threshold: number | undefined): number {
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0) {
    return DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS
  }

  return Math.floor(threshold)
}

function parseDateOnly(value: string | null | undefined): { utcDay: number } | null {
  if (typeof value !== 'string') {
    return null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utcDay = Date.UTC(year, month - 1, day)
  const parsed = new Date(utcDay)

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return { utcDay }
}
