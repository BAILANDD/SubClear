import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  SUPPORTED_SCHEMA_VERSIONS,
  RENEWAL_STATUSES,
  CANCELLATION_STATUSES,
  MEMBERSHIP_STATUSES,
  EVIDENCE_TYPES,
  REVIEW_STATUSES,
  type CaptureSessionDraft,
  type EvidenceRecord,
  type FieldEvidence,
  type StorageEnvelope,
  type SubscriptionFacts,
  type TechnicalStorageMetadata,
} from '../types'

describe('AI Capture data model contract', () => {
  it('defines the current supported schema version', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1)
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([1])
  })

  it('exposes locked status and review enum values', () => {
    expect(RENEWAL_STATUSES).toEqual([
      'auto_renew_on',
      'auto_renew_off',
      'manual_renewal',
      'not_applicable',
      'unknown',
    ])
    expect(CANCELLATION_STATUSES).toEqual(['none', 'planned', 'in_progress', 'confirmed'])
    expect(MEMBERSHIP_STATUSES).toEqual(['trial', 'active', 'expiring_soon', 'expired', 'unknown'])
    expect(EVIDENCE_TYPES).toEqual(['direct', 'inferred', 'missing', 'conflict', 'user_edited'])
    expect(REVIEW_STATUSES).toEqual(['ready', 'needs_review', 'missing', 'conflict', 'confirmed'])
    expect(REVIEW_STATUSES).not.toContain('cleared')
    expect(REVIEW_STATUSES).not.toContain('user_edited')
  })

  it('keeps subscription facts, storage metadata, and derived state separate', () => {
    const serviceNameEvidence: FieldEvidence = {
      field_name: 'service_name',
      extracted_value: 'Example Video VIP',
      source_text: 'Example Video VIP 会员',
      evidence_type: 'direct',
      review_status: 'ready',
      is_inferred: false,
      user_confirmed: false,
      confirmed_at: null,
    }

    const evidenceRecord: EvidenceRecord = {
      evidence_id: 'evidence_001',
      source_type: 'in_app_membership',
      file_name: 'membership-center.png',
      fixture_reference: null,
      extraction_method: 'fixture',
      processing_status: 'completed',
      created_at: '2026-07-14T00:00:00.000Z',
      extracted_fields: [serviceNameEvidence],
    }

    const record: SubscriptionFacts = {
      id: 'sub_001',
      service_name: 'Example Video VIP',
      plan_name: null,
      category: null,
      platform: null,
      entitlement_type: 'paid_membership',
      membership_start_date: null,
      membership_end_date: '2026-08-30',
      renewal_status: 'auto_renew_on',
      next_charge_date: null,
      renewal_price: null,
      currency: null,
      billing_cycle: null,
      cancellation_status: 'none',
      cancellation_path: null,
      cancellation_steps: [],
      cancellation_deadline: null,
      planned_cancel_date: null,
      cancellation_completed_at: null,
      cancellation_proof: null,
      reminder_settings: {
        enabled: true,
        offset_days: 7,
      },
      evidence_records: [evidenceRecord],
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: '2026-07-14T00:00:00.000Z',
      updated_at: '2026-07-14T00:00:00.000Z',
    }

    expect(record).not.toHaveProperty('membership_status')
    expect(record).not.toHaveProperty('remaining_days')
    expect(record.evidence_records[0]).not.toHaveProperty('raw_image_base64')
    expect(record.evidence_records[0]).not.toHaveProperty('object_url')
    expectTypeOf(record).toMatchTypeOf<SubscriptionFacts>()

    const metadata: TechnicalStorageMetadata = {
      migrated_at: '2026-07-14T00:00:00.000Z',
      storage_revision: 1,
    }

    expect(metadata).not.toHaveProperty('created_at')
    expect(metadata).not.toHaveProperty('updated_at')
  })

  it('models runtime-only capture drafts separately from persisted records', () => {
    const draft: CaptureSessionDraft = {
      session_id: 'capture_session_001',
      lifecycle_state: 'reviewing',
      source: {
        source_type: 'in_app_membership',
        file_name: 'membership-center.png',
      },
      temporary_image: {
        kind: 'object_url',
        object_url: 'blob:http://localhost/temporary-preview',
      },
      draft_record: null,
      review_fields: [],
    }

    const envelope: StorageEnvelope<SubscriptionFacts> = {
      schema_version: CURRENT_SCHEMA_VERSION,
      records: [],
    }

    expect(draft.temporary_image).toHaveProperty('object_url')
    expect(envelope).not.toHaveProperty('temporary_image')
    expectTypeOf(draft).toMatchTypeOf<CaptureSessionDraft>()
    expectTypeOf(envelope).toMatchTypeOf<StorageEnvelope<SubscriptionFacts>>()
  })
})
