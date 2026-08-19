export type SubscriptionType = 'paid' | 'trial'

export type SubscriptionStatus = 'active' | 'planned_to_cancel' | 'cancelled'

export type BillingCycle = 'monthly' | 'yearly' | 'weekly' | 'custom'

export type ReminderState = 'enabled' | 'disabled' | 'blocked'

// Current Manual MVP legacy model. Batch 1B keeps this shape intact so existing
// pages, store, mock data, and export utilities continue to compile unchanged.
export interface Subscription {
  id: string
  service_name: string
  type: SubscriptionType
  price?: number
  currency?: string
  billing_cycle?: BillingCycle
  renewal_date?: string
  trial_end_date?: string
  price_after_trial?: number
  status: SubscriptionStatus
  cancel_url_or_note?: string
  cancellation_steps?: string
  cancellation_proof?: string
  planned_cancel_date?: string
  cancellation_date?: string
  reminder_enabled: boolean
  reminder_offset_days: number
  reminder_state: ReminderState
  notes?: string
  created_at: string
  updated_at: string
}

export * from './capture'
export * from './evidence'
export * from './storage'
export * from './subscription'
