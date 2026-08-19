import { describe, expect, it } from 'vitest'
import { mockSubscriptions } from '../data/mockData'
import {
  CURRENT_SCHEMA_VERSION,
  type StorageEnvelope,
  type Subscription,
  type SubscriptionRecord,
} from '../types'
import {
  detectStoredDataFormat,
  isLegacySubscription,
  migrateLegacySubscription,
  migrateStoredData,
  type MigrationResult,
} from '../storage/migration'

const MIGRATED_AT = '2026-07-15T00:00:00.000Z'

function baseLegacy(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'legacy_001',
    service_name: 'Example Video VIP',
    type: 'paid',
    price: 12.99,
    currency: 'CNY',
    billing_cycle: 'monthly',
    renewal_date: '2026-08-30',
    status: 'active',
    cancel_url_or_note: 'Account > Subscription > Cancel',
    cancellation_steps: 'Open account settings > Cancel renewal',
    reminder_enabled: true,
    reminder_offset_days: 7,
    reminder_state: 'enabled',
    notes: 'Legacy note',
    created_at: '2026-06-01T08:00:00.000Z',
    updated_at: '2026-06-15T09:30:00.000Z',
    ...overrides,
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function expectMigrated(result: MigrationResult) {
  expect(result.status).toBe('migrated')
  if (result.status !== 'migrated') {
    throw new Error(`Expected migrated result, received ${result.status}`)
  }
  return result
}

function expectAlreadyCurrent(result: MigrationResult) {
  expect(result.status).toBe('already_current')
  if (result.status !== 'already_current') {
    throw new Error(`Expected already_current result, received ${result.status}`)
  }
  return result
}

function expectInvalid(result: MigrationResult) {
  expect(result.status).toBe('invalid_data')
  if (result.status !== 'invalid_data') {
    throw new Error(`Expected invalid_data result, received ${result.status}`)
  }
  return result
}

describe('legacy migration contract', () => {
  it('detects legacy arrays, current envelopes, unsupported versions, and malformed input', () => {
    const currentEnvelope: StorageEnvelope<SubscriptionRecord> = {
      schema_version: CURRENT_SCHEMA_VERSION,
      records: [],
    }

    expect(detectStoredDataFormat([baseLegacy()])).toBe('legacy_unversioned_array')
    expect(detectStoredDataFormat(JSON.stringify([baseLegacy()]))).toBe('legacy_unversioned_array')
    expect(detectStoredDataFormat(currentEnvelope)).toBe('current_envelope')
    expect(detectStoredDataFormat({ schema_version: 99, records: [] })).toBe('unsupported_version')
    expect(detectStoredDataFormat({ records: [] })).toBe('malformed')
    expect(detectStoredDataFormat('{invalid json')).toBe('malformed')
  })

  it('migrates a valid old free trial without inventing renewal facts', () => {
    const trial = baseLegacy({
      id: 'trial_001',
      type: 'trial',
      price: undefined,
      price_after_trial: 20,
      trial_end_date: '2026-08-15',
      renewal_date: undefined,
    })

    const result = migrateLegacySubscription(trial, { migratedAt: MIGRATED_AT })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error.reason)

    expect(result.record.facts.id).toBe('trial_001')
    expect(result.record.facts.service_name).toBe('Example Video VIP')
    expect(result.record.facts.entitlement_type).toBe('trial')
    expect(result.record.facts.membership_end_date).toBe('2026-08-15')
    expect(result.record.facts.next_charge_date).toBeNull()
    expect(result.record.facts.renewal_price).toBe(20)
    expect(result.record.facts.renewal_status).toBe('unknown')
    expect(result.record.facts.schema_version).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.record.facts.created_at).toBe('2026-06-01T08:00:00.000Z')
    expect(result.record.facts.updated_at).toBe('2026-06-15T09:30:00.000Z')
    expect(result.record.facts.evidence_records).toEqual([])
    expect(result.record.metadata?.migrated_at).toBe(MIGRATED_AT)
  })

  it('migrates a valid old paid subscription with charge facts only where legacy data exists', () => {
    const paid = baseLegacy()

    const result = migrateLegacySubscription(paid, { migratedAt: MIGRATED_AT })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error.reason)

    expect(result.record.facts.id).toBe('legacy_001')
    expect(result.record.facts.entitlement_type).toBe('paid_membership')
    expect(result.record.facts.membership_end_date).toBeNull()
    expect(result.record.facts.next_charge_date).toBe('2026-08-30')
    expect(result.record.facts.renewal_price).toBe(12.99)
    expect(result.record.facts.currency).toBe('CNY')
    expect(result.record.facts.billing_cycle).toBe('monthly')
    expect(result.record.facts.renewal_status).toBe('unknown')
    expect(result.record.facts.reminder_settings).toEqual({
      enabled: true,
      offset_days: 7,
      state: 'enabled',
    })
  })

  it('maps planned_to_cancel to a cancellation task without changing membership state', () => {
    const planned = baseLegacy({
      status: 'planned_to_cancel',
      planned_cancel_date: '2026-08-20',
    })

    const result = migrateLegacySubscription(planned, { migratedAt: MIGRATED_AT })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error.reason)

    expect(result.record.facts.cancellation_status).toBe('planned')
    expect(result.record.facts.cancellation_path).toBe('Account > Subscription > Cancel')
    expect(result.record.facts.cancellation_steps).toEqual(['Open account settings > Cancel renewal'])
    expect(result.record.facts.planned_cancel_date).toBe('2026-08-20')
    expect(result.record.facts.cancellation_completed_at).toBeNull()
    expect(result.record.facts).not.toHaveProperty('membership_status')
  })

  it('maps cancelled to confirmed cancellation without marking membership as expired', () => {
    const cancelled = baseLegacy({
      status: 'cancelled',
      cancellation_date: '2026-07-01',
      cancellation_proof: '[confirmation-screenshot]',
    })

    const result = migrateLegacySubscription(cancelled, { migratedAt: MIGRATED_AT })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error.reason)

    expect(result.record.facts.cancellation_status).toBe('confirmed')
    expect(result.record.facts.renewal_status).toBe('auto_renew_off')
    expect(result.record.facts.cancellation_completed_at).toBe('2026-07-01')
    expect(result.record.facts.cancellation_proof).toBe('[confirmation-screenshot]')
    expect(result.record.facts).not.toHaveProperty('membership_status')
  })

  it('allows missing optional legacy data without inventing values', () => {
    const sparse = baseLegacy({
      price: undefined,
      currency: undefined,
      billing_cycle: undefined,
      renewal_date: undefined,
      cancel_url_or_note: '',
      cancellation_steps: undefined,
    })

    const result = migrateLegacySubscription(sparse, { migratedAt: MIGRATED_AT })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.error.reason)

    expect(result.record.facts.renewal_price).toBeNull()
    expect(result.record.facts.currency).toBeNull()
    expect(result.record.facts.billing_cycle).toBeNull()
    expect(result.record.facts.next_charge_date).toBeNull()
    expect(result.record.facts.cancellation_path).toBeNull()
    expect(result.record.facts.cancellation_steps).toEqual([])
    expect(result.record.facts.category).toBeNull()
    expect(result.record.facts.platform).toBeNull()
    expect(result.record.facts.plan_name).toBeNull()
  })

  it('fails safely when required identity is missing', () => {
    const missingIdentity: Record<string, unknown> = { ...baseLegacy() }
    delete missingIdentity.service_name

    expect(isLegacySubscription(missingIdentity)).toBe(false)

    const result = migrateStoredData([missingIdentity], { migratedAt: MIGRATED_AT })
    const invalid = expectInvalid(result)

    expect(invalid.errors[0]?.reason).toBe('missing_required_identity')
    expect(missingIdentity).not.toHaveProperty('service_name')
  })

  it('reports malformed records without crashing', () => {
    const result = migrateStoredData([{ id: 42, service_name: 'Broken' }], {
      migratedAt: MIGRATED_AT,
    })
    const invalid = expectInvalid(result)

    expect(invalid.errors[0]?.reason).toBe('invalid_legacy_type')
  })

  it('reports invalid JSON, null, and invalid current envelopes safely', () => {
    const invalidJson = expectInvalid(migrateStoredData('{invalid json', { migratedAt: MIGRATED_AT }))
    expect(invalidJson.errors[0]?.reason).toBe('invalid_json')

    const nullInput = expectInvalid(migrateStoredData(null, { migratedAt: MIGRATED_AT }))
    expect(nullInput.errors[0]?.reason).toBe('malformed_input')

    const invalidEnvelope = expectInvalid(
      migrateStoredData({ schema_version: CURRENT_SCHEMA_VERSION, records: [{ facts: {} }] }, {
        migratedAt: MIGRATED_AT,
      }),
    )
    expect(invalidEnvelope.errors[0]?.reason).toBe('invalid_current_envelope')
  })

  it('partially migrates mixed valid and invalid legacy arrays', () => {
    const malformed: Record<string, unknown> = { ...baseLegacy(), id: 42 }

    const result = migrateStoredData([baseLegacy({ id: 'valid_001' }), malformed], {
      migratedAt: MIGRATED_AT,
    })
    const migrated = expectMigrated(result)

    expect(migrated.migrated_count).toBe(1)
    expect(migrated.failed_records).toHaveLength(1)
    expect(migrated.envelope.records[0]?.facts.id).toBe('valid_001')
    expect(migrated.failed_records[0]?.input).toEqual(malformed)
  })

  it('treats an already migrated current envelope as current without rewriting records', () => {
    const migrated = expectMigrated(
      migrateStoredData([baseLegacy()], { migratedAt: MIGRATED_AT }),
    )
    const originalEnvelope = cloneJson(migrated.envelope)

    const rerun = migrateStoredData(migrated.envelope, { migratedAt: '2030-01-01T00:00:00.000Z' })
    const current = expectAlreadyCurrent(rerun)

    expect(current.envelope).toEqual(originalEnvelope)
  })

  it('rejects unknown schema versions without downgrade or overwrite behavior', () => {
    const result = migrateStoredData({ schema_version: 99, records: [] }, { migratedAt: MIGRATED_AT })

    expect(result.status).toBe('unsupported_version')
    if (result.status !== 'unsupported_version') {
      throw new Error(`Expected unsupported_version result, received ${result.status}`)
    }
    expect(result.schema_version).toBe(99)
  })

  it('is idempotent for repeated migration through the stored data entry point', () => {
    const first = expectMigrated(migrateStoredData([baseLegacy()], { migratedAt: MIGRATED_AT }))
    const second = expectAlreadyCurrent(
      migrateStoredData(first.envelope, { migratedAt: '2031-01-01T00:00:00.000Z' }),
    )

    expect(second.envelope.records).toEqual(first.envelope.records)
    expect(second.envelope.records).toHaveLength(1)
  })

  it('does not mutate original legacy input', () => {
    const legacy = baseLegacy()
    const before = cloneJson(legacy)

    migrateStoredData([legacy], { migratedAt: MIGRATED_AT })

    expect(legacy).toEqual(before)
  })

  it('uses fixed migration timestamps when legacy timestamps are missing or invalid', () => {
    const invalidTimestamps: Record<string, unknown> = {
      ...baseLegacy(),
      created_at: 'not-a-date',
      updated_at: undefined,
    }

    const result = migrateStoredData([invalidTimestamps], { migratedAt: MIGRATED_AT })
    const migrated = expectMigrated(result)

    expect(migrated.envelope.records[0]?.facts.created_at).toBe(MIGRATED_AT)
    expect(migrated.envelope.records[0]?.facts.updated_at).toBe(MIGRATED_AT)
    expect(migrated.envelope.records[0]?.metadata?.migrated_at).toBe(MIGRATED_AT)
  })

  it('can process the current manual MVP mock data without changing mock fixtures', () => {
    const before = cloneJson(mockSubscriptions)

    const result = migrateStoredData(mockSubscriptions, { migratedAt: MIGRATED_AT })
    const migrated = expectMigrated(result)

    expect(migrated.migrated_count).toBe(mockSubscriptions.length)
    expect(migrated.failed_records).toEqual([])
    expect(migrated.envelope.records.find((record) => record.facts.id === 's7')?.facts.reminder_settings)
      .toEqual({
        enabled: true,
        offset_days: 7,
        state: 'blocked',
      })
    expect(mockSubscriptions).toEqual(before)
  })
})
