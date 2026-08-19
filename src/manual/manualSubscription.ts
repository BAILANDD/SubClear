import {
  CURRENT_SCHEMA_VERSION,
  type EntitlementType,
  type RenewalStatus,
  type SubscriptionFactBillingCycle,
  type SubscriptionRecord,
} from '../types'

export const MANUAL_RENEWAL_OPTIONS: ReadonlyArray<{
  value: RenewalStatus
  label: string
}> = [
  { value: 'unknown', label: '暂不确定' },
  { value: 'auto_renew_on', label: '自动续费' },
  { value: 'auto_renew_off', label: '已关闭自动续费' },
  { value: 'manual_renewal', label: '手动续费' },
  { value: 'not_applicable', label: '无需续费' },
]

export const MANUAL_PLATFORM_OPTIONS: ReadonlyArray<{
  value: string
  label: string
}> = [
  { value: '', label: '暂不确定' },
  { value: '官方网站', label: '官方网站' },
  { value: 'App Store', label: 'App Store' },
  { value: 'Google Play', label: 'Google Play' },
  { value: '__other__', label: '其他' },
]

export function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export interface ManualSubscriptionRecordInput {
  id: string
  serviceName: string
  entitlementType: Extract<EntitlementType, 'trial' | 'paid_membership'>
  membershipStartDate: string | null
  membershipEndDate: string | null
  renewalStatus: RenewalStatus
  nextChargeDate: string | null
  renewalPrice: number | null
  currency: string | null
  billingCycle: SubscriptionFactBillingCycle | null
  cancellationPath: string | null
  platform: string | null
  reminderOffsetDays: number
  timestamp: string
}

export function buildManualSubscriptionRecord(
  input: ManualSubscriptionRecordInput,
): SubscriptionRecord {
  return {
    facts: {
      id: input.id,
      service_name: input.serviceName,
      plan_name: null,
      category: null,
      platform: input.platform,
      entitlement_type: input.entitlementType,
      membership_start_date: input.membershipStartDate,
      membership_end_date: input.membershipEndDate,
      renewal_status: input.renewalStatus,
      next_charge_date:
        input.renewalStatus === 'auto_renew_on' ? input.nextChargeDate : null,
      renewal_price: input.renewalPrice,
      currency: input.currency,
      billing_cycle: input.billingCycle,
      cancellation_status: 'none',
      cancellation_path: input.cancellationPath,
      cancellation_steps: [],
      cancellation_deadline: null,
      planned_cancel_date: null,
      cancellation_completed_at: null,
      cancellation_proof: null,
      reminder_settings: {
        enabled: true,
        offset_days: input.reminderOffsetDays,
        state: 'enabled',
      },
      evidence_records: [],
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: input.timestamp,
      updated_at: input.timestamp,
    },
  }
}
