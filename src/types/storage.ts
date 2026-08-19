import type { SubscriptionFacts } from './subscription'

export const CURRENT_SCHEMA_VERSION = 1 as const

export type CurrentSchemaVersion = typeof CURRENT_SCHEMA_VERSION

export const SUPPORTED_SCHEMA_VERSIONS = [CURRENT_SCHEMA_VERSION] as const

export type SupportedSchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number]

export interface TechnicalStorageMetadata {
  migrated_at?: string
  storage_revision?: number
}

export interface SubscriptionRecord {
  facts: SubscriptionFacts
  metadata?: TechnicalStorageMetadata
}

export interface StorageEnvelope<TRecord = SubscriptionRecord> {
  schema_version: SupportedSchemaVersion
  records: TRecord[]
  metadata?: TechnicalStorageMetadata
}

export type UnknownStorageEnvelope = {
  schema_version: number
  records?: unknown
} & Record<string, unknown>
