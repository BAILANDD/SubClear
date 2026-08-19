import type { ReminderCapabilityState, SubscriptionRecord } from '../types'

export type ReminderTrigger =
  | {
      status: 'available'
      type: 'planned_cancellation' | 'next_charge' | 'membership_end'
      date: string
      label: string
    }
  | {
      status: 'unavailable'
      type: 'unavailable'
      date: null
      label: 'date unavailable'
    }

export type ReminderUpdateResult =
  | {
      ok: true
      record: SubscriptionRecord
    }
  | {
      ok: false
      error: 'invalid_offset'
      record: SubscriptionRecord
    }

export function getReminderTrigger(record: SubscriptionRecord): ReminderTrigger {
  const facts = record.facts

  if (
    (facts.cancellation_status === 'planned' || facts.cancellation_status === 'in_progress') &&
    isDateOnly(facts.planned_cancel_date)
  ) {
    return {
      status: 'available',
      type: 'planned_cancellation',
      date: facts.planned_cancel_date,
      label: 'planned cancellation',
    }
  }

  if (facts.renewal_status === 'auto_renew_on' && isDateOnly(facts.next_charge_date)) {
    return {
      status: 'available',
      type: 'next_charge',
      date: facts.next_charge_date,
      label: 'next charge',
    }
  }

  if (isDateOnly(facts.membership_end_date)) {
    return {
      status: 'available',
      type: 'membership_end',
      date: facts.membership_end_date,
      label: 'membership end',
    }
  }

  return {
    status: 'unavailable',
    type: 'unavailable',
    date: null,
    label: 'date unavailable',
  }
}

export function buildReminderUpdate(
  record: SubscriptionRecord,
  input: {
    enabled: boolean
    offsetDays: number
    updatedAt: string
  },
): ReminderUpdateResult {
  if (!isValidOffset(input.offsetDays)) {
    return {
      ok: false,
      error: 'invalid_offset',
      record,
    }
  }

  const trigger = getReminderTrigger(record)
  const previousState = record.facts.reminder_settings.state
  const state = getReminderCapabilityState({
    enabled: input.enabled,
    triggerAvailable: trigger.status === 'available',
    previousState,
  })

  return {
    ok: true,
    record: {
      ...record,
      facts: {
        ...record.facts,
        reminder_settings: {
          enabled: input.enabled,
          offset_days: input.offsetDays,
          state,
        },
        updated_at: input.updatedAt,
      },
    },
  }
}

export function isValidReminderOffset(value: number): boolean {
  return isValidOffset(value)
}

export function getReminderStateForInput(
  record: SubscriptionRecord,
  enabled: boolean,
): ReminderCapabilityState {
  return getReminderCapabilityState({
    enabled,
    triggerAvailable: getReminderTrigger(record).status === 'available',
    previousState: record.facts.reminder_settings.state,
  })
}

function getReminderCapabilityState({
  enabled,
  triggerAvailable,
  previousState,
}: {
  enabled: boolean
  triggerAvailable: boolean
  previousState: ReminderCapabilityState | undefined
}): ReminderCapabilityState {
  if (!enabled) {
    return 'disabled'
  }

  if (!triggerAvailable || previousState === 'blocked') {
    return 'blocked'
  }

  return 'enabled'
}

function isValidOffset(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 30
}

function isDateOnly(value: string | null | undefined): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}
