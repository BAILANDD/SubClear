import type { Subscription, BillingCycle, ReminderState, SubscriptionStatus } from '../types'
import type { SubscriptionRecord } from '../types/storage'
import type { SubscriptionFactBillingCycle } from '../types/subscription'

export function projectSubscriptionRecordToLegacySubscription(record: SubscriptionRecord): Subscription {
  const facts = record.facts
  const isTrial = facts.entitlement_type === 'trial'

  return {
    id: facts.id,
    service_name: facts.service_name,
    type: isTrial ? 'trial' : 'paid',
    price: isTrial ? undefined : facts.renewal_price ?? undefined,
    price_after_trial: isTrial ? facts.renewal_price ?? undefined : undefined,
    currency: facts.currency ?? undefined,
    billing_cycle: mapBillingCycle(facts.billing_cycle),
    renewal_date: isTrial ? undefined : facts.next_charge_date ?? undefined,
    trial_end_date: isTrial ? facts.membership_end_date ?? undefined : undefined,
    status: mapLegacyStatus(facts.cancellation_status),
    cancel_url_or_note: facts.cancellation_path ?? undefined,
    cancellation_steps:
      facts.cancellation_steps.length > 0 ? facts.cancellation_steps.join('\n') : undefined,
    cancellation_proof: facts.cancellation_proof ?? undefined,
    planned_cancel_date: facts.planned_cancel_date ?? undefined,
    cancellation_date: facts.cancellation_completed_at ?? undefined,
    reminder_enabled: facts.reminder_settings.enabled,
    reminder_offset_days: facts.reminder_settings.offset_days,
    reminder_state: facts.reminder_settings.state ?? 'enabled',
    notes: undefined,
    created_at: facts.created_at,
    updated_at: facts.updated_at,
  }
}

export function projectSubscriptionRecordsToLegacySubscriptions(
  records: readonly SubscriptionRecord[],
): Subscription[] {
  return records.map(projectSubscriptionRecordToLegacySubscription)
}

function mapLegacyStatus(cancellationStatus: string): SubscriptionStatus {
  if (cancellationStatus === 'planned' || cancellationStatus === 'in_progress') {
    return 'planned_to_cancel'
  }

  if (cancellationStatus === 'confirmed') {
    return 'cancelled'
  }

  return 'active'
}

function mapBillingCycle(cycle: SubscriptionFactBillingCycle | null): BillingCycle | undefined {
  if (cycle === 'monthly' || cycle === 'yearly' || cycle === 'weekly' || cycle === 'custom') {
    return cycle
  }

  return undefined
}

export function mapLegacyReminderState(state: ReminderState | undefined): ReminderState {
  return state ?? 'enabled'
}
