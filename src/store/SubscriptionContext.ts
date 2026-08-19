import { createContext } from 'react'
import type { Subscription, SubscriptionStatus, ReminderState } from '../types'
import type { SubscriptionRecord } from '../types/storage'
import { migrateLegacySubscription } from '../storage/migration'
import {
  loadSubscriptionRecordsFromStorage,
  persistSubscriptionRecordsToStorage,
  SUBSCRIPTION_STORAGE_KEY,
} from '../storage/subscriptionStorage'

export const STORAGE_KEY = SUBSCRIPTION_STORAGE_KEY

export interface CanonicalState {
  records: SubscriptionRecord[]
  canPersist: boolean
  storageError: string | null
}

export function loadInitialState(): CanonicalState {
  const result = loadSubscriptionRecordsFromStorage(localStorage, {
    migratedAt: new Date().toISOString(),
  })

  return {
    records: result.records,
    canPersist: result.canPersist,
    storageError: result.canPersist ? null : result.message,
  }
}

export function persist(state: CanonicalState): boolean {
  if (!state.canPersist) {
    return false
  }

  return persistSubscriptionRecordsToStorage(localStorage, state.records).ok
}

export type Action =
  | { type: 'ADD_SUBSCRIPTION'; payload: Subscription }
  | { type: 'UPDATE_SUBSCRIPTION'; payload: Subscription }
  | { type: 'CHANGE_STATUS'; payload: { id: string; status: SubscriptionStatus } }
  | { type: 'ADD_SUBSCRIPTION_RECORD'; payload: SubscriptionRecord }
  | { type: 'DELETE_SUBSCRIPTION_RECORD'; payload: { id: string } }

export function reducer(state: CanonicalState, action: Action): CanonicalState {
  switch (action.type) {
    case 'ADD_SUBSCRIPTION': {
      const migrated = migrateLegacySubscription(action.payload, {
        migratedAt: action.payload.updated_at,
      })
      if (!migrated.ok) return state
      return {
        ...state,
        records: [...state.records, migrated.record],
      }
    }

    case 'ADD_SUBSCRIPTION_RECORD':
      return {
        ...state,
        records: [...state.records.filter((record) => record.facts.id !== action.payload.facts.id), action.payload],
      }

    case 'DELETE_SUBSCRIPTION_RECORD':
      return {
        ...state,
        records: state.records.filter((record) => record.facts.id !== action.payload.id),
      }

    case 'UPDATE_SUBSCRIPTION': {
      const now = new Date().toISOString()
      const payload = {
        ...action.payload,
        updated_at: now,
      }
      const migrated = migrateLegacySubscription(payload, { migratedAt: now })
      if (!migrated.ok) return state
      return {
        ...state,
        records: state.records.map((record) =>
          record.facts.id === payload.id ? mergeLegacyUpdate(record, migrated.record) : record,
        ),
      }
    }

    case 'CHANGE_STATUS': {
      const { id, status } = action.payload
      return {
        ...state,
        records: state.records.map((record) => {
          if (record.facts.id !== id) return record

          const facts = record.facts
          const now = new Date().toISOString()
          if (status === 'cancelled') {
            return {
              ...record,
              facts: {
                ...facts,
                cancellation_status: 'confirmed',
                cancellation_completed_at: facts.cancellation_completed_at ?? now.split('T')[0],
                reminder_settings: {
                  ...facts.reminder_settings,
                  enabled: false,
                  state: 'disabled',
                },
                updated_at: now,
              },
            }
          }

          if (status === 'active' && facts.cancellation_status === 'confirmed') {
            return {
              ...record,
              facts: {
                ...facts,
                cancellation_status: 'none',
                cancellation_completed_at: null,
                reminder_settings: {
                  ...facts.reminder_settings,
                  enabled: true,
                  state: 'enabled',
                },
                updated_at: now,
              },
            }
          }

          return {
            ...record,
            facts: {
              ...facts,
              cancellation_status: status === 'planned_to_cancel' ? 'planned' : 'none',
              updated_at: now,
            },
          }
        }),
      }
    }

    default:
      return state
  }
}

function mergeLegacyUpdate(existing: SubscriptionRecord, next: SubscriptionRecord): SubscriptionRecord {
  return {
    ...existing,
    facts: {
      ...next.facts,
      evidence_records: existing.facts.evidence_records,
      schema_version: existing.facts.schema_version,
      created_at: existing.facts.created_at,
      updated_at: next.facts.updated_at,
    },
    metadata: existing.metadata,
  }
}

export function projectRecordStatus(record: SubscriptionRecord): SubscriptionStatus {
  switch (record.facts.cancellation_status) {
    case 'planned':
    case 'in_progress':
      return 'planned_to_cancel'
    case 'confirmed':
      return 'cancelled'
    case 'none':
      return 'active'
  }
}

export function projectRecordReminderState(record: SubscriptionRecord): ReminderState {
  return record.facts.reminder_settings.state ?? 'enabled'
}

export interface ContextValue {
  subscriptions: Subscription[]
  records: SubscriptionRecord[]
  storageError: string | null
  addSubscription: (sub: Subscription) => void
  updateSubscription: (sub: Subscription) => void
  changeStatus: (id: string, status: SubscriptionStatus) => void
  addSubscriptionRecord: (record: SubscriptionRecord) => boolean
  updateSubscriptionRecord: (
    id: string,
    update: (record: SubscriptionRecord) => SubscriptionRecord,
  ) => boolean
  deleteSubscriptionRecord: (id: string) => boolean
}

export const SubscriptionContext = createContext<ContextValue | null>(null)
