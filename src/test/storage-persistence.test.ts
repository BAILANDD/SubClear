import { describe, expect, it, vi } from 'vitest'
import { mockSubscriptions } from '../data/mockData'
import { projectSubscriptionRecordToLegacySubscription } from '../compatibility/legacySubscriptionAdapter'
import {
  LEGACY_BACKUP_STORAGE_KEY,
  loadSubscriptionRecordsFromStorage,
  persistSubscriptionRecordsToStorage,
} from '../storage/subscriptionStorage'
import { CURRENT_SCHEMA_VERSION, type SubscriptionRecord } from '../types'

const MIGRATED_AT = '2026-07-15T00:00:00.000Z'

function storageWith(value: string | null) {
  const map = new Map<string, string>()
  if (value !== null) map.set('subclear_subscriptions', value)
  return {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, nextValue: string) => {
      map.set(key, nextValue)
    }),
  }
}

describe('subscription storage activation', () => {
  it('migrates legacy arrays into a current envelope and creates a one-time backup', () => {
    const legacyJson = JSON.stringify(mockSubscriptions.slice(0, 2))
    const storage = storageWith(legacyJson)

    const result = loadSubscriptionRecordsFromStorage(storage, { migratedAt: MIGRATED_AT })

    expect(result.status).toBe('migrated')
    expect(result.records).toHaveLength(2)
    expect(storage.setItem).toHaveBeenCalledWith(LEGACY_BACKUP_STORAGE_KEY, legacyJson)
    expect(result.canPersist).toBe(true)
  })

  it('does not overwrite an existing legacy backup', () => {
    const storage = storageWith(JSON.stringify(mockSubscriptions.slice(0, 1)))
    storage.setItem(LEGACY_BACKUP_STORAGE_KEY, 'already-backed-up')
    vi.mocked(storage.setItem).mockClear()

    loadSubscriptionRecordsFromStorage(storage, { migratedAt: MIGRATED_AT })

    expect(storage.setItem).not.toHaveBeenCalledWith(LEGACY_BACKUP_STORAGE_KEY, expect.any(String))
  })

  it('loads current envelopes without migration or backup', () => {
    const migrated = loadSubscriptionRecordsFromStorage(storageWith(JSON.stringify(mockSubscriptions.slice(0, 1))), {
      migratedAt: MIGRATED_AT,
    })
    if (migrated.status !== 'migrated') throw new Error('expected migrated setup')
    const envelopeJson = JSON.stringify({
      schema_version: CURRENT_SCHEMA_VERSION,
      records: migrated.records,
    })
    const storage = storageWith(envelopeJson)

    const result = loadSubscriptionRecordsFromStorage(storage, { migratedAt: MIGRATED_AT })

    expect(result.status).toBe('current')
    expect(result.records).toHaveLength(1)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('blocks persistence for unsupported or malformed stored data', () => {
    const unsupported = loadSubscriptionRecordsFromStorage(
      storageWith(JSON.stringify({ schema_version: 999, records: [] })),
      { migratedAt: MIGRATED_AT },
    )
    const malformed = loadSubscriptionRecordsFromStorage(storageWith('{bad json'), {
      migratedAt: MIGRATED_AT,
    })

    expect(unsupported).toMatchObject({ status: 'unsupported_version', canPersist: false })
    expect(malformed).toMatchObject({ status: 'invalid_data', canPersist: false })
  })

  it('persists current envelope as the canonical source', () => {
    const migrated = loadSubscriptionRecordsFromStorage(storageWith(JSON.stringify(mockSubscriptions.slice(0, 1))), {
      migratedAt: MIGRATED_AT,
    })
    if (migrated.status !== 'migrated') throw new Error('expected migrated setup')
    const storage = storageWith(null)

    const result = persistSubscriptionRecordsToStorage(storage, migrated.records)

    expect(result.ok).toBe(true)
    const written = JSON.parse(vi.mocked(storage.setItem).mock.calls[0][1]) as {
      schema_version: number
      records: SubscriptionRecord[]
    }
    expect(written.schema_version).toBe(CURRENT_SCHEMA_VERSION)
    expect(written.records[0].facts.service_name).toBe(mockSubscriptions[0].service_name)
  })

  it('projects canonical records to the legacy UI model without losing canonical evidence', () => {
    const migrated = loadSubscriptionRecordsFromStorage(storageWith(JSON.stringify(mockSubscriptions.slice(0, 1))), {
      migratedAt: MIGRATED_AT,
    })
    if (migrated.status !== 'migrated') throw new Error('expected migrated setup')

    const legacy = projectSubscriptionRecordToLegacySubscription(migrated.records[0])

    expect(legacy).toMatchObject({
      id: mockSubscriptions[0].id,
      service_name: mockSubscriptions[0].service_name,
      type: 'trial',
      status: 'active',
      trial_end_date: mockSubscriptions[0].trial_end_date,
      reminder_enabled: mockSubscriptions[0].reminder_enabled,
    })
    expect(migrated.records[0].facts.evidence_records).toEqual([])
  })
})
