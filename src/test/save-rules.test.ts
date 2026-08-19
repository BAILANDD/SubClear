import { describe, expect, it } from 'vitest'
import { createFixtureCaptureDraft } from '../fixtures/membershipFixture'
import {
  buildSubscriptionRecordFromReview,
  validateReviewForSave,
} from '../save/saveRecord'
import { confirmAllReadyFields, confirmField, editFieldCandidate } from '../review/reviewState'

const CAPTURED_AT = '2026-07-15T00:00:00.000Z'
const SAVED_AT = '2026-07-15T01:00:00.000Z'
const RECORD_ID = 'sub_saved_001'

function draft() {
  return createFixtureCaptureDraft({
    file: new File([new Uint8Array([1])], 'subclear-membership-demo.png', { type: 'image/png' }),
    capturedAt: CAPTURED_AT,
    sessionId: 'save_rules_test',
  })
}

function confirmServiceNameOnly() {
  return confirmField(draft(), {
    evidenceId: 'evidence_save_rules_test',
    fieldName: 'service_name',
    confirmedAt: SAVED_AT,
  })
}

describe('review save rules', () => {
  it('blocks save when service_name candidate is present but unconfirmed', () => {
    expect(validateReviewForSave(draft())).toEqual({
      status: 'missing_required_identity',
      message: '请先确认服务名称，再保存记录。',
    })
  })

  it('allows incomplete save when required identity is confirmed and optional fields remain unresolved', () => {
    expect(validateReviewForSave(confirmServiceNameOnly())).toEqual({
      status: 'valid_incomplete',
      unresolved_count: 5,
    })
  })

  it('allows complete save when every review field is confirmed', () => {
    let reviewed = confirmAllReadyFields(draft(), SAVED_AT)
    reviewed = confirmField(reviewed, {
      evidenceId: 'evidence_save_rules_test',
      fieldName: 'renewal_status',
      confirmedAt: SAVED_AT,
    })
    reviewed = editFieldCandidate(reviewed, {
      evidenceId: 'evidence_save_rules_test',
      fieldName: 'renewal_price',
      value: 28,
    })
    reviewed = confirmField(reviewed, {
      evidenceId: 'evidence_save_rules_test',
      fieldName: 'renewal_price',
      confirmedAt: SAVED_AT,
    })
    reviewed = editFieldCandidate(reviewed, {
      evidenceId: 'evidence_save_rules_test',
      fieldName: 'cancellation_path',
      value: 'Membership Settings > Renewal',
    })
    reviewed = confirmField(reviewed, {
      evidenceId: 'evidence_save_rules_test',
      fieldName: 'cancellation_path',
      confirmedAt: SAVED_AT,
    })

    expect(validateReviewForSave(reviewed)).toEqual({ status: 'valid_complete' })
  })

  it('does not block complete save for optional missing cancellation path', () => {
    let reviewed = confirmAllReadyFields(draft(), SAVED_AT)
    reviewed = confirmField(reviewed, {
      evidenceId: 'evidence_save_rules_test',
      fieldName: 'renewal_status',
      confirmedAt: SAVED_AT,
    })
    reviewed = editFieldCandidate(reviewed, {
      evidenceId: 'evidence_save_rules_test',
      fieldName: 'renewal_price',
      value: 28,
    })
    reviewed = confirmField(reviewed, {
      evidenceId: 'evidence_save_rules_test',
      fieldName: 'renewal_price',
      confirmedAt: SAVED_AT,
    })

    expect(validateReviewForSave(reviewed)).toEqual({ status: 'valid_complete' })
  })

  it('builds a SubscriptionRecord from confirmed facts while preserving unresolved evidence metadata', () => {
    const reviewed = confirmServiceNameOnly()
    const record = buildSubscriptionRecordFromReview(reviewed, {
      id: RECORD_ID,
      savedAt: SAVED_AT,
    })

    expect(record.facts).toMatchObject({
      id: RECORD_ID,
      service_name: 'Aurora Plus',
      plan_name: null,
      membership_end_date: null,
      renewal_status: 'unknown',
      renewal_price: null,
      cancellation_path: null,
      schema_version: 1,
      created_at: SAVED_AT,
      updated_at: SAVED_AT,
    })
    expect(record.facts.evidence_records[0].extracted_fields).toEqual(reviewed.review_fields)
    expect(
      record.facts.evidence_records[0].extracted_fields.find(
        (field) => field.field_name === 'renewal_price',
      ),
    ).toMatchObject({
      evidence_type: 'conflict',
      review_status: 'conflict',
      extracted_value: {
        candidates: ['28', '30'],
        currency: 'CNY',
      },
    })
    expect(JSON.stringify(record)).not.toMatch(/base64|data:image|object_url/i)
  })
})
