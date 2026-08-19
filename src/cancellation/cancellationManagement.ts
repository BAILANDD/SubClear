import type { CancellationStatus, SubscriptionRecord } from '../types'

export type CancellationUpdateResult =
  | {
      ok: true
      record: SubscriptionRecord
    }
  | {
      ok: false
      error: 'invalid_status' | 'invalid_date' | 'invalid_reminder_lead'
      record: SubscriptionRecord
    }

export const CANCELLATION_REMINDER_LEADS = [0, 1, 2, 3, 7] as const

export type CancellationReminderLead = (typeof CANCELLATION_REMINDER_LEADS)[number]

export function buildCancellationPlan(
  record: SubscriptionRecord,
  input: {
    plannedDate: string
    reminderLeadDays: number
    updatedAt: string
  },
): CancellationUpdateResult {
  const plannedDate = normalizeRequiredDate(input.plannedDate)
  if (plannedDate === 'invalid') {
    return {
      ok: false,
      error: 'invalid_date',
      record,
    }
  }

  if (!isCancellationReminderLead(input.reminderLeadDays)) {
    return {
      ok: false,
      error: 'invalid_reminder_lead',
      record,
    }
  }

  return {
    ok: true,
    record: {
      ...record,
      facts: {
        ...record.facts,
        cancellation_status: 'planned',
        planned_cancel_date: plannedDate,
        cancellation_completed_at: null,
        reminder_settings: {
          enabled: true,
          offset_days: input.reminderLeadDays,
          state: 'enabled',
        },
        updated_at: input.updatedAt,
      },
    },
  }
}

export function buildCancellationConfirmation(
  record: SubscriptionRecord,
  input: {
    updatedAt: string
  },
): CancellationUpdateResult {
  return {
    ok: true,
    record: {
      ...record,
      facts: {
        ...record.facts,
        cancellation_status: 'confirmed',
        cancellation_completed_at:
          record.facts.cancellation_completed_at ?? input.updatedAt.split('T')[0],
        renewal_status:
          record.facts.renewal_status === 'auto_renew_on'
            ? 'auto_renew_off'
            : record.facts.renewal_status,
        updated_at: input.updatedAt,
      },
    },
  }
}

export function getDefaultPlannedCancelDate(nextChargeDate: string | null): string | null {
  if (!isDateOnly(nextChargeDate)) {
    return null
  }

  return addUtcDays(nextChargeDate, -1)
}

export function getCancellationReminderDate(
  plannedDate: string | null,
  reminderLeadDays: number,
): string | null {
  if (!isDateOnly(plannedDate) || !isCancellationReminderLead(reminderLeadDays)) {
    return null
  }

  return addUtcDays(plannedDate, -reminderLeadDays)
}

export function buildCancellationUpdate(
  record: SubscriptionRecord,
  input: {
    status: CancellationStatus
    path: string
    stepsText: string
    deadline: string
    plannedDate: string
    proof: string
    updatedAt: string
  },
): CancellationUpdateResult {
  if (!isCancellationStatus(input.status)) {
    return {
      ok: false,
      error: 'invalid_status',
      record,
    }
  }

  const deadline = normalizeOptionalDate(input.deadline)
  const plannedDate = normalizeOptionalDate(input.plannedDate)
  if (deadline === 'invalid' || plannedDate === 'invalid') {
    return {
      ok: false,
      error: 'invalid_date',
      record,
    }
  }

  return {
    ok: true,
    record: {
      ...record,
      facts: {
        ...record.facts,
        cancellation_status: input.status,
        cancellation_path: normalizeOptionalText(input.path),
        cancellation_steps: stepsFromText(input.stepsText),
        cancellation_deadline: deadline,
        planned_cancel_date: plannedDate,
        cancellation_completed_at: getCompletionDate(record, input.status, input.updatedAt),
        cancellation_proof: normalizeOptionalText(input.proof),
        updated_at: input.updatedAt,
      },
    },
  }
}

export function stepsFromText(value: string): string[] {
  return value
    .split('\n')
    .map((step) => step.trim())
    .filter(Boolean)
}

export function stepsToText(value: readonly string[]): string {
  return value.join('\n')
}

export function getSafeExternalCancellationUrl(value: string | null): URL | null {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url
    }
  } catch {
    return null
  }

  return null
}

function getCompletionDate(
  record: SubscriptionRecord,
  status: CancellationStatus,
  updatedAt: string,
): string | null {
  if (status === 'confirmed') {
    return record.facts.cancellation_completed_at ?? updatedAt.split('T')[0]
  }

  return null
}

function normalizeOptionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeOptionalDate(value: string): string | null | 'invalid' {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return isDateOnly(trimmed) ? trimmed : 'invalid'
}

function normalizeRequiredDate(value: string): string | 'invalid' {
  const trimmed = value.trim()
  return isDateOnly(trimmed) ? trimmed : 'invalid'
}

function isCancellationStatus(value: string): value is CancellationStatus {
  return value === 'none' || value === 'planned' || value === 'in_progress' || value === 'confirmed'
}

function isCancellationReminderLead(value: number): value is CancellationReminderLead {
  return CANCELLATION_REMINDER_LEADS.includes(value as CancellationReminderLead)
}

function addUtcDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().split('T')[0]
}

function isDateOnly(value: string | null | undefined): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
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
