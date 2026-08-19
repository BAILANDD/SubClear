import type { EvidenceRecord } from './evidence'
import type { CurrentSchemaVersion } from './storage'

export const RENEWAL_STATUSES = [
  'auto_renew_on',
  'auto_renew_off',
  'manual_renewal',
  'not_applicable',
  'unknown',
] as const

export type RenewalStatus = (typeof RENEWAL_STATUSES)[number]

export const CANCELLATION_STATUSES = ['none', 'planned', 'in_progress', 'confirmed'] as const

export type CancellationStatus = (typeof CANCELLATION_STATUSES)[number]

export const MEMBERSHIP_STATUSES = ['trial', 'active', 'expiring_soon', 'expired', 'unknown'] as const

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number]

export type EntitlementType =
  | 'trial'
  | 'paid_membership'
  | 'one_time_purchase'
  | 'lifetime'
  | 'unknown'

export type SubscriptionFactBillingCycle =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom'
  | 'unknown'

export type ReminderCapabilityState = 'enabled' | 'disabled' | 'blocked'

export interface ReminderSettings {
  enabled: boolean
  offset_days: number
  state?: ReminderCapabilityState
}

export interface SubscriptionFacts {
  id: string
  service_name: string
  plan_name: string | null
  category: string | null
  platform: string | null
  entitlement_type: EntitlementType
  membership_start_date: string | null
  membership_end_date: string | null
  renewal_status: RenewalStatus
  next_charge_date: string | null
  renewal_price: number | null
  currency: string | null
  billing_cycle: SubscriptionFactBillingCycle | null
  cancellation_status: CancellationStatus
  cancellation_path: string | null
  cancellation_steps: string[]
  cancellation_deadline: string | null
  planned_cancel_date: string | null
  cancellation_completed_at: string | null
  cancellation_proof: string | null
  reminder_settings: ReminderSettings
  evidence_records: EvidenceRecord[]
  schema_version: CurrentSchemaVersion
  created_at: string
  updated_at: string
}

export interface DerivedRuntimeState {
  membership_status: MembershipStatus
  remaining_days: number | null
  is_expiring_soon: boolean
  upcoming_charge_bucket: string | null
  needs_review_count: number
  dashboard_counts: {
    needs_review: number
    expiring_soon: number
    upcoming_charges: number
    cancellation_tasks: number
  }
}
