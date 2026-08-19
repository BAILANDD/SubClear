import { describe, expect, it } from 'vitest'
import {
  CURRENT_SCHEMA_VERSION,
  type EvidenceRecord,
  type FieldEvidence,
  type SubscriptionFacts,
  type SubscriptionRecord,
} from '../types'
import {
  applyEvidenceCandidate,
  clearSavedEvidenceCandidate,
  confirmSavedEvidenceField,
} from '../evidence/evidenceResolution'

const UPDATED_AT = '2026-07-15T12:00:00.000Z'

function field(overrides: Partial<FieldEvidence> = {}): FieldEvidence {
  return {
    field_name: 'renewal_price',
    extracted_value: 28,
    source_text: '¥28 / month',
    evidence_type: 'conflict',
    review_status: 'conflict',
    is_inferred: false,
    user_confirmed: false,
    confirmed_at: null,
    ...overrides,
  }
}

function evidenceRecord(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    evidence_id: 'evidence_001',
    source_type: 'in_app_membership',
    file_name: 'membership.png',
    fixture_reference: null,
    extraction_method: 'fixture',
    processing_status: 'completed',
    created_at: '2026-07-01T00:00:00.000Z',
    extracted_fields: [field()],
    ...overrides,
  }
}

function facts(overrides: Partial<SubscriptionFacts> = {}): SubscriptionFacts {
  return {
    id: 'sub_001',
    service_name: 'Aurora Plus',
    plan_name: 'Premium',
    category: null,
    platform: null,
    entitlement_type: 'paid_membership',
    membership_start_date: null,
    membership_end_date: null,
    renewal_status: 'unknown',
    next_charge_date: null,
    renewal_price: null,
    currency: null,
    billing_cycle: null,
    cancellation_status: 'none',
    cancellation_path: 'Old path',
    cancellation_steps: ['Old step'],
    cancellation_deadline: null,
    planned_cancel_date: null,
    cancellation_completed_at: null,
    cancellation_proof: null,
    reminder_settings: {
      enabled: true,
      offset_days: 7,
      state: 'enabled',
    },
    evidence_records: [evidenceRecord()],
    schema_version: CURRENT_SCHEMA_VERSION,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function record(overrides: Partial<SubscriptionFacts> = {}): SubscriptionRecord {
  return {
    facts: facts(overrides),
    metadata: {
      migrated_at: '2026-07-01T00:00:00.000Z',
    },
  }
}

describe('saved evidence resolution', () => {
  it('edits a candidate by evidence_id and field_name without changing the saved fact', () => {
    const input = record()

    const result = applyEvidenceCandidate(input, {
      evidenceId: 'evidence_001',
      fieldName: 'renewal_price',
      value: 30,
      updatedAt: UPDATED_AT,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.reason)
    expect(result.record.facts.renewal_price).toBeNull()
    expect(result.record.facts.updated_at).toBe(UPDATED_AT)
    expect(result.record.metadata).toEqual(input.metadata)
    expect(result.record.facts.evidence_records[0].extracted_fields[0]).toMatchObject({
      extracted_value: 30,
      evidence_type: 'user_edited',
      review_status: 'needs_review',
      user_confirmed: false,
      confirmed_at: null,
    })
    expect(input.facts.evidence_records[0].extracted_fields[0].extracted_value).toBe(28)
  })

  it('confirms a candidate and patches the matching fact while preserving unrelated data', () => {
    const input = record()
    const edited = applyEvidenceCandidate(input, {
      evidenceId: 'evidence_001',
      fieldName: 'renewal_price',
      value: 30,
      updatedAt: UPDATED_AT,
    })
    if (!edited.ok) throw new Error(edited.reason)

    const confirmed = confirmSavedEvidenceField(edited.record, {
      evidenceId: 'evidence_001',
      fieldName: 'renewal_price',
      confirmedAt: '2026-07-15T12:01:00.000Z',
    })

    expect(confirmed.ok).toBe(true)
    if (!confirmed.ok) throw new Error(confirmed.reason)
    expect(confirmed.record.facts.renewal_price).toBe(30)
    expect(confirmed.record.facts.cancellation_path).toBe('Old path')
    expect(confirmed.record.metadata).toEqual(input.metadata)
    expect(confirmed.record.facts.evidence_records[0].extracted_fields[0]).toMatchObject({
      review_status: 'confirmed',
      user_confirmed: true,
      confirmed_at: '2026-07-15T12:01:00.000Z',
    })
  })

  it('clears a saved candidate without deleting the previous confirmed fact', () => {
    const input = record({
      plan_name: 'Premium',
      evidence_records: [
        evidenceRecord({
          extracted_fields: [
            field({
              field_name: 'plan_name',
              extracted_value: 'Premium',
              evidence_type: 'direct',
              review_status: 'confirmed',
              user_confirmed: true,
              confirmed_at: '2026-07-01T00:00:00.000Z',
            }),
          ],
        }),
      ],
    })

    const result = clearSavedEvidenceCandidate(input, {
      evidenceId: 'evidence_001',
      fieldName: 'plan_name',
      updatedAt: UPDATED_AT,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.reason)
    expect(result.record.facts.plan_name).toBe('Premium')
    expect(result.record.facts.evidence_records[0].extracted_fields[0]).toMatchObject({
      extracted_value: null,
      evidence_type: 'missing',
      review_status: 'missing',
      user_confirmed: false,
      confirmed_at: null,
    })
  })

  it('rejects empty confirmed service_name and invalid typed values', () => {
    const emptyName = record({
      evidence_records: [
        evidenceRecord({
          extracted_fields: [
            field({
              field_name: 'service_name',
              extracted_value: '',
              evidence_type: 'user_edited',
              review_status: 'needs_review',
            }),
          ],
        }),
      ],
    })

    expect(
      confirmSavedEvidenceField(emptyName, {
        evidenceId: 'evidence_001',
        fieldName: 'service_name',
        confirmedAt: UPDATED_AT,
      }),
    ).toMatchObject({ ok: false, reason: 'invalid_value' })

    const invalidPrice = record()
    const edited = applyEvidenceCandidate(invalidPrice, {
      evidenceId: 'evidence_001',
      fieldName: 'renewal_price',
      value: 'not a number',
      updatedAt: UPDATED_AT,
    })
    if (!edited.ok) throw new Error(edited.reason)
    expect(
      confirmSavedEvidenceField(edited.record, {
        evidenceId: 'evidence_001',
        fieldName: 'renewal_price',
        confirmedAt: UPDATED_AT,
      }),
    ).toMatchObject({ ok: false, reason: 'invalid_value' })
  })
})
