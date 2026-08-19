import { mockSubscriptions } from '../data/mockData'
import { migrateLegacySubscriptions, migrateStoredData } from './migration'
import {
  CURRENT_SCHEMA_VERSION,
  type StorageEnvelope,
  type SubscriptionRecord,
} from '../types/storage'

export const SUBSCRIPTION_STORAGE_KEY = 'subclear_subscriptions'
export const LEGACY_BACKUP_STORAGE_KEY = 'subclear_subscriptions_legacy_backup'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type LoadSubscriptionStorageResult =
  | {
      status: 'empty_seeded'
      records: SubscriptionRecord[]
      canPersist: true
    }
  | {
      status: 'migrated'
      records: SubscriptionRecord[]
      canPersist: true
    }
  | {
      status: 'current'
      records: SubscriptionRecord[]
      canPersist: true
    }
  | {
      status: 'unsupported_version'
      records: SubscriptionRecord[]
      canPersist: false
      message: string
    }
  | {
      status: 'invalid_data'
      records: SubscriptionRecord[]
      canPersist: false
      message: string
    }

export interface LoadSubscriptionStorageOptions {
  migratedAt: string
}

export type PersistSubscriptionRecordsResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: 'storage_unavailable'
    }

export function loadSubscriptionRecordsFromStorage(
  storage: StorageLike,
  options: LoadSubscriptionStorageOptions,
): LoadSubscriptionStorageResult {
  const raw = storage.getItem(SUBSCRIPTION_STORAGE_KEY)

  if (!raw) {
    const seeded = migrateLegacySubscriptions(mockSubscriptions, { migratedAt: options.migratedAt })
    return {
      status: 'empty_seeded',
      records: seeded.status === 'migrated' ? seeded.envelope.records : [],
      canPersist: true,
    }
  }

  const migration = migrateStoredData(raw, { migratedAt: options.migratedAt })
  if (migration.status === 'migrated') {
    createLegacyBackupIfMissing(storage, raw)
    return {
      status: 'migrated',
      records: migration.envelope.records,
      canPersist: true,
    }
  }

  if (migration.status === 'already_current') {
    return {
      status: 'current',
      records: migration.envelope.records,
      canPersist: true,
    }
  }

  if (migration.status === 'unsupported_version') {
    return {
      status: 'unsupported_version',
      records: [],
      canPersist: false,
      message: 'Stored data uses an unsupported schema version.',
    }
  }

  return {
    status: 'invalid_data',
    records: [],
    canPersist: false,
    message: 'Stored data could not be read safely.',
  }
}

export function persistSubscriptionRecordsToStorage(
  storage: StorageLike,
  records: readonly SubscriptionRecord[],
): PersistSubscriptionRecordsResult {
  const envelope: StorageEnvelope<SubscriptionRecord> = {
    schema_version: CURRENT_SCHEMA_VERSION,
    records: records.map((record) => ({
      ...record,
      facts: {
        ...record.facts,
        evidence_records: record.facts.evidence_records.map((evidenceRecord) => ({
          ...evidenceRecord,
          extracted_fields: evidenceRecord.extracted_fields.map((field) => ({ ...field })),
        })),
      },
      metadata: record.metadata ? { ...record.metadata } : undefined,
    })),
  }

  try {
    storage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(envelope))
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'storage_unavailable',
    }
  }
}

function createLegacyBackupIfMissing(storage: StorageLike, rawLegacyValue: string) {
  if (storage.getItem(LEGACY_BACKUP_STORAGE_KEY) !== null) {
    return
  }

  storage.setItem(LEGACY_BACKUP_STORAGE_KEY, rawLegacyValue)
}
