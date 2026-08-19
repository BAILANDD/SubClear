import { describe, expect, it } from 'vitest'
import { createFixtureCaptureDraft } from '../fixtures/membershipFixture'
import {
  clearFieldCandidate,
  confirmAllReadyFields,
  confirmField,
  editFieldCandidate,
  setFieldNotApplicable,
} from '../review/reviewState'

const CONFIRMED_AT = '2026-07-15T01:00:00.000Z'

function draft() {
  return createFixtureCaptureDraft({
    file: new File([new Uint8Array([1])], 'subclear-membership-demo.png', { type: 'image/png' }),
    capturedAt: '2026-07-15T00:00:00.000Z',
    sessionId: 'review_state_test',
  })
}

describe('review state transitions', () => {
  it('confirms direct ready fields without changing evidence type', () => {
    const next = confirmField(draft(), {
      evidenceId: 'evidence_review_state_test',
      fieldName: 'service_name',
      confirmedAt: CONFIRMED_AT,
    })
    const field = next.review_fields.find((item) => item.field_name === 'service_name')

    expect(field).toMatchObject({
      evidence_type: 'direct',
      review_status: 'confirmed',
      user_confirmed: true,
      confirmed_at: CONFIRMED_AT,
    })
  })

  it('requires edited values to be confirmed again', () => {
    const edited = editFieldCandidate(draft(), {
      evidenceId: 'evidence_review_state_test',
      fieldName: 'service_name',
      value: 'Aurora Plus Edited',
    })
    const editedField = edited.review_fields.find((item) => item.field_name === 'service_name')

    expect(editedField).toMatchObject({
      extracted_value: 'Aurora Plus Edited',
      evidence_type: 'user_edited',
      review_status: 'needs_review',
      user_confirmed: false,
      confirmed_at: null,
    })

    const confirmed = confirmField(edited, {
      evidenceId: 'evidence_review_state_test',
      fieldName: 'service_name',
      confirmedAt: CONFIRMED_AT,
    })
    expect(confirmed.review_fields.find((item) => item.field_name === 'service_name')).toMatchObject({
      review_status: 'confirmed',
      user_confirmed: true,
      confirmed_at: CONFIRMED_AT,
    })
  })

  it('clears candidates into missing without creating a cleared status', () => {
    const next = clearFieldCandidate(draft(), {
      evidenceId: 'evidence_review_state_test',
      fieldName: 'renewal_status',
    })
    const field = next.review_fields.find((item) => item.field_name === 'renewal_status')

    expect(field).toMatchObject({
      extracted_value: null,
      evidence_type: 'missing',
      review_status: 'missing',
      user_confirmed: false,
      confirmed_at: null,
    })
    expect(field?.review_status).not.toBe('cleared')
  })

  it('supports missing add value and conflict resolve as user edited transitions', () => {
    const missingAdded = editFieldCandidate(draft(), {
      evidenceId: 'evidence_review_state_test',
      fieldName: 'cancellation_path',
      value: 'Membership Settings > Renewal',
    })
    expect(
      missingAdded.review_fields.find((item) => item.field_name === 'cancellation_path'),
    ).toMatchObject({
      evidence_type: 'user_edited',
      review_status: 'needs_review',
      user_confirmed: false,
    })

    const conflictResolved = editFieldCandidate(draft(), {
      evidenceId: 'evidence_review_state_test',
      fieldName: 'renewal_price',
      value: 28,
    })
    expect(conflictResolved.review_fields.find((item) => item.field_name === 'renewal_price')).toMatchObject({
      evidence_type: 'user_edited',
      review_status: 'needs_review',
      user_confirmed: false,
    })
  })

  it('only allows not applicable for supported fields and still requires confirmation', () => {
    const next = setFieldNotApplicable(draft(), {
      evidenceId: 'evidence_review_state_test',
      fieldName: 'renewal_status',
    })

    expect(next.ok).toBe(true)
    if (next.ok) {
      expect(next.draft.review_fields.find((item) => item.field_name === 'renewal_status')).toMatchObject({
        extracted_value: 'not_applicable',
        evidence_type: 'user_edited',
        review_status: 'needs_review',
        user_confirmed: false,
      })
    }

    expect(
      setFieldNotApplicable(draft(), {
        evidenceId: 'evidence_review_state_test',
        fieldName: 'service_name',
      }),
    ).toEqual({ ok: false, reason: 'not_supported' })
  })

  it('confirms only direct ready fields when confirming all ready', () => {
    const next = confirmAllReadyFields(draft(), CONFIRMED_AT)

    expect(next.review_fields.find((item) => item.field_name === 'service_name')).toMatchObject({
      review_status: 'confirmed',
      user_confirmed: true,
    })
    expect(next.review_fields.find((item) => item.field_name === 'plan_name')).toMatchObject({
      review_status: 'confirmed',
      user_confirmed: true,
    })
    expect(next.review_fields.find((item) => item.field_name === 'renewal_status')).toMatchObject({
      evidence_type: 'inferred',
      review_status: 'needs_review',
      user_confirmed: false,
    })
    expect(next.review_fields.find((item) => item.field_name === 'cancellation_path')).toMatchObject({
      review_status: 'missing',
      user_confirmed: false,
    })
    expect(next.review_fields.find((item) => item.field_name === 'renewal_price')).toMatchObject({
      review_status: 'conflict',
      user_confirmed: false,
    })
  })
})
