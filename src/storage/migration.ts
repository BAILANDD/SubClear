import type {
  BillingCycle,
  ReminderState,
  Subscription as LegacySubscription,
  SubscriptionStatus,
  SubscriptionType,
} from '../types'
import {
  CURRENT_SCHEMA_VERSION,
  type StorageEnvelope,
  type SubscriptionRecord,
  type TechnicalStorageMetadata,
} from '../types/storage'
import type {
  CancellationStatus,
  EntitlementType,
  RenewalStatus,
  SubscriptionFactBillingCycle,
  SubscriptionFacts,
} from '../types/subscription'

export type LegacySubscriptionInput = Omit<LegacySubscription, 'created_at' | 'updated_at'> &
  Partial<Pick<LegacySubscription, 'created_at' | 'updated_at'>>

export type StoredDataFormat =
  | 'legacy_unversioned_array'
  | 'current_envelope'
  | 'unsupported_version'
  | 'malformed'

export type MigrationFailureReason =
  | 'invalid_json'
  | 'malformed_input'
  | 'invalid_record'
  | 'missing_required_identity'
  | 'invalid_legacy_type'
  | 'invalid_legacy_status'
  | 'invalid_current_envelope'

export interface MigrationFailure {
  index?: number
  reason: MigrationFailureReason
  input: unknown
}

export interface MigrationContext {
  migratedAt: string
}

export type MigrateLegacySubscriptionResult =
  | {
      ok: true
      record: SubscriptionRecord
    }
  | {
      ok: false
      error: MigrationFailure
    }

export type MigrationResult =
  | {
      status: 'migrated'
      envelope: StorageEnvelope<SubscriptionRecord>
      migrated_count: number
      failed_records: MigrationFailure[]
      warnings: string[]
    }
  | {
      status: 'already_current'
      envelope: StorageEnvelope<SubscriptionRecord>
    }
  | {
      status: 'unsupported_version'
      schema_version: number
      input: unknown
    }
  | {
      status: 'invalid_data'
      input: unknown
      errors: MigrationFailure[]
    }

const LEGACY_TYPES = ['paid', 'trial'] as const satisfies readonly SubscriptionType[]
const LEGACY_STATUSES = [
  'active',
  'planned_to_cancel',
  'cancelled',
] as const satisfies readonly SubscriptionStatus[]
const LEGACY_BILLING_CYCLES = [
  'monthly',
  'yearly',
  'weekly',
  'custom',
] as const satisfies readonly BillingCycle[]
const LEGACY_REMINDER_STATES = [
  'enabled',
  'disabled',
  'blocked',
] as const satisfies readonly ReminderState[]

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === 'number'
}

function includesString<const T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value)
}

function parseStoredInput(input: unknown): { ok: true; value: unknown } | { ok: false } {
  if (typeof input !== 'string') {
    return { ok: true, value: input }
  }

  try {
    return { ok: true, value: JSON.parse(input) as unknown }
  } catch {
    return { ok: false }
  }
}

export function detectStoredDataFormat(input: unknown): StoredDataFormat {
  const parsed = parseStoredInput(input)
  if (!parsed.ok) return 'malformed'

  if (Array.isArray(parsed.value)) {
    return 'legacy_unversioned_array'
  }

  if (!isRecord(parsed.value)) {
    return 'malformed'
  }

  if (typeof parsed.value.schema_version !== 'number') {
    return 'malformed'
  }

  if (parsed.value.schema_version === CURRENT_SCHEMA_VERSION) {
    return 'current_envelope'
  }

  return 'unsupported_version'
}

export function isLegacySubscription(input: unknown): input is LegacySubscriptionInput {
  return validateLegacySubscription(input).ok
}

function validateLegacySubscription(
  input: unknown,
  index?: number,
): { ok: true; value: LegacySubscriptionInput } | { ok: false; error: MigrationFailure } {
  if (!isRecord(input)) {
    return { ok: false, error: { index, reason: 'invalid_record', input } }
  }

  if (!isNonEmptyString(input.service_name)) {
    return { ok: false, error: { index, reason: 'missing_required_identity', input } }
  }

  if (!includesString(LEGACY_TYPES, input.type)) {
    return { ok: false, error: { index, reason: 'invalid_legacy_type', input } }
  }

  if (!includesString(LEGACY_STATUSES, input.status)) {
    return { ok: false, error: { index, reason: 'invalid_legacy_status', input } }
  }

  if (!isNonEmptyString(input.id)) {
    return { ok: false, error: { index, reason: 'invalid_record', input } }
  }

  if (
    !isOptionalNumber(input.price) ||
    !isOptionalNumber(input.price_after_trial) ||
    !isOptionalString(input.currency) ||
    !isOptionalString(input.renewal_date) ||
    !isOptionalString(input.trial_end_date) ||
    !isOptionalString(input.cancel_url_or_note) ||
    !isOptionalString(input.cancellation_steps) ||
    !isOptionalString(input.cancellation_proof) ||
    !isOptionalString(input.planned_cancel_date) ||
    !isOptionalString(input.cancellation_date) ||
    !isOptionalString(input.notes) ||
    !isOptionalString(input.created_at) ||
    !isOptionalString(input.updated_at)
  ) {
    return { ok: false, error: { index, reason: 'invalid_record', input } }
  }

  if (
    input.billing_cycle !== undefined &&
    !includesString(LEGACY_BILLING_CYCLES, input.billing_cycle)
  ) {
    return { ok: false, error: { index, reason: 'invalid_record', input } }
  }

  if (
    typeof input.reminder_enabled !== 'boolean' ||
    typeof input.reminder_offset_days !== 'number' ||
    !includesString(LEGACY_REMINDER_STATES, input.reminder_state)
  ) {
    return { ok: false, error: { index, reason: 'invalid_record', input } }
  }

  return {
    ok: true,
    value: input as LegacySubscriptionInput,
  }
}

export function migrateLegacySubscription(
  input: unknown,
  context: MigrationContext,
  index?: number,
): MigrateLegacySubscriptionResult {
  const legacy = validateLegacySubscription(input, index)
  if (!legacy.ok) {
    return { ok: false, error: legacy.error }
  }

  const value = legacy.value
  const metadata: TechnicalStorageMetadata = {
    migrated_at: context.migratedAt,
  }

  const facts: SubscriptionFacts = {
    id: value.id,
    service_name: value.service_name.trim(),
    plan_name: null,
    category: null,
    platform: null,
    entitlement_type: mapEntitlementType(value.type),
    membership_start_date: null,
    membership_end_date:
      value.type === 'trial' ? normalizeDateOnly(value.trial_end_date) : null,
    renewal_status: mapRenewalStatus(value.status),
    next_charge_date: value.type === 'paid' ? normalizeDateOnly(value.renewal_date) : null,
    renewal_price: mapRenewalPrice(value),
    currency: normalizeOptionalString(value.currency),
    billing_cycle: mapBillingCycle(value.billing_cycle),
    cancellation_status: mapCancellationStatus(value.status),
    cancellation_path: normalizeOptionalString(value.cancel_url_or_note),
    cancellation_steps: normalizeCancellationSteps(value.cancellation_steps),
    cancellation_deadline: null,
    planned_cancel_date: normalizeDateOnly(value.planned_cancel_date),
    cancellation_completed_at: normalizeDateOnly(value.cancellation_date),
    cancellation_proof: normalizeOptionalString(value.cancellation_proof),
    reminder_settings: {
      enabled: value.reminder_enabled,
      offset_days: value.reminder_offset_days,
      state: value.reminder_state,
    },
    evidence_records: [],
    schema_version: CURRENT_SCHEMA_VERSION,
    created_at: normalizeTimestamp(value.created_at, context.migratedAt),
    updated_at: normalizeTimestamp(value.updated_at, context.migratedAt),
  }

  return {
    ok: true,
    record: {
      facts,
      metadata,
    },
  }
}

export function migrateLegacySubscriptions(
  records: readonly unknown[],
  context: MigrationContext,
): MigrationResult {
  const migratedRecords: SubscriptionRecord[] = []
  const failedRecords: MigrationFailure[] = []

  records.forEach((record, index) => {
    const result = migrateLegacySubscription(record, context, index)
    if (result.ok) {
      migratedRecords.push(result.record)
    } else {
      failedRecords.push(result.error)
    }
  })

  if (migratedRecords.length === 0 && failedRecords.length > 0) {
    return {
      status: 'invalid_data',
      input: records,
      errors: failedRecords,
    }
  }

  return {
    status: 'migrated',
    envelope: {
      schema_version: CURRENT_SCHEMA_VERSION,
      records: migratedRecords,
    },
    migrated_count: migratedRecords.length,
    failed_records: failedRecords,
    warnings: [],
  }
}

export function migrateStoredData(input: unknown, context: MigrationContext): MigrationResult {
  const parsed = parseStoredInput(input)
  if (!parsed.ok) {
    return {
      status: 'invalid_data',
      input,
      errors: [{ reason: 'invalid_json', input }],
    }
  }

  if (Array.isArray(parsed.value)) {
    return migrateLegacySubscriptions(parsed.value, context)
  }

  if (!isRecord(parsed.value)) {
    return {
      status: 'invalid_data',
      input: parsed.value,
      errors: [{ reason: 'malformed_input', input: parsed.value }],
    }
  }

  if (typeof parsed.value.schema_version !== 'number') {
    return {
      status: 'invalid_data',
      input: parsed.value,
      errors: [{ reason: 'malformed_input', input: parsed.value }],
    }
  }

  if (parsed.value.schema_version !== CURRENT_SCHEMA_VERSION) {
    return {
      status: 'unsupported_version',
      schema_version: parsed.value.schema_version,
      input: parsed.value,
    }
  }

  if (!isCurrentStorageEnvelope(parsed.value)) {
    return {
      status: 'invalid_data',
      input: parsed.value,
      errors: [{ reason: 'invalid_current_envelope', input: parsed.value }],
    }
  }

  return {
    status: 'already_current',
    envelope: parsed.value,
  }
}

function mapEntitlementType(type: SubscriptionType): EntitlementType {
  return type === 'trial' ? 'trial' : 'paid_membership'
}

function mapRenewalStatus(status: SubscriptionStatus): RenewalStatus {
  if (status === 'cancelled') {
    return 'auto_renew_off'
  }

  return 'unknown'
}

function mapCancellationStatus(status: SubscriptionStatus): CancellationStatus {
  if (status === 'planned_to_cancel') {
    return 'planned'
  }

  if (status === 'cancelled') {
    return 'confirmed'
  }

  return 'none'
}

function mapRenewalPrice(record: LegacySubscriptionInput): number | null {
  if (record.type === 'trial') {
    return typeof record.price_after_trial === 'number' ? record.price_after_trial : null
  }

  return typeof record.price === 'number' ? record.price : null
}

function mapBillingCycle(
  billingCycle: BillingCycle | undefined,
): SubscriptionFactBillingCycle | null {
  return billingCycle ?? null
}

function normalizeOptionalString(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeCancellationSteps(value: string | undefined): string[] {
  const normalized = normalizeOptionalString(value)
  return normalized ? [normalized] : []
}

function normalizeDateOnly(value: string | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null
  }

  const parsed = Date.parse(`${trimmed}T00:00:00.000Z`)
  return Number.isNaN(parsed) ? null : trimmed
}

function normalizeTimestamp(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return fallback
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsedDate = Date.parse(`${trimmed}T00:00:00.000Z`)
    return Number.isNaN(parsedDate) ? fallback : `${trimmed}T00:00:00.000Z`
  }

  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? fallback : trimmed
}

function isCurrentStorageEnvelope(input: unknown): input is StorageEnvelope<SubscriptionRecord> {
  if (!isRecord(input)) {
    return false
  }

  if (input.schema_version !== CURRENT_SCHEMA_VERSION || !Array.isArray(input.records)) {
    return false
  }

  if (input.metadata !== undefined && !isTechnicalStorageMetadata(input.metadata)) {
    return false
  }

  return input.records.every(isSubscriptionRecord)
}

function isSubscriptionRecord(input: unknown): input is SubscriptionRecord {
  if (!isRecord(input)) {
    return false
  }

  if (!isSubscriptionFacts(input.facts)) {
    return false
  }

  return input.metadata === undefined || isTechnicalStorageMetadata(input.metadata)
}

function isSubscriptionFacts(input: unknown): input is SubscriptionFacts {
  if (!isRecord(input)) {
    return false
  }

  return (
    isNonEmptyString(input.id) &&
    isNonEmptyString(input.service_name) &&
    input.schema_version === CURRENT_SCHEMA_VERSION &&
    isNonEmptyString(input.created_at) &&
    isNonEmptyString(input.updated_at) &&
    includesString(['trial', 'paid_membership', 'one_time_purchase', 'lifetime', 'unknown'], input.entitlement_type) &&
    includesString(
      ['auto_renew_on', 'auto_renew_off', 'manual_renewal', 'not_applicable', 'unknown'],
      input.renewal_status,
    ) &&
    includesString(['none', 'planned', 'in_progress', 'confirmed'], input.cancellation_status) &&
    Array.isArray(input.evidence_records)
  )
}

function isTechnicalStorageMetadata(input: unknown): input is TechnicalStorageMetadata {
  if (!isRecord(input)) {
    return false
  }

  return (
    (input.migrated_at === undefined || typeof input.migrated_at === 'string') &&
    (input.storage_revision === undefined || typeof input.storage_revision === 'number')
  )
}
