import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, type EvidenceRecord, type SubscriptionFacts, type SubscriptionRecord } from '../types'
import { buildReminderUpdate, getReminderTrigger } from '../reminder/reminderManagement'

const CREATED_AT = '2026-07-01T00:00:00.000Z'
const UPDATED_AT = '2026-07-15T00:00:00.000Z'

function evidence(): EvidenceRecord {
  return {
    evidence_id: 'evidence_001',
    source_type: 'in_app_membership',
    file_name: 'membership.png',
    fixture_reference: null,
    extraction_method: 'fixture',
    processing_status: 'completed',
    created_at: CREATED_AT,
    extracted_fields: [
      {
        field_name: 'cancellation_path',
        extracted_value: 'Settings > Membership',
        source_text: 'Settings > Membership',
        evidence_type: 'inferred',
        review_status: 'needs_review',
        is_inferred: true,
        user_confirmed: false,
        confirmed_at: null,
      },
    ],
  }
}

function record(overrides: Partial<SubscriptionFacts> = {}): SubscriptionRecord {
  return {
    facts: {
      id: 'record_001',
      service_name: 'Example Service',
      plan_name: null,
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
      cancellation_path: null,
      cancellation_steps: [],
      cancellation_deadline: null,
      planned_cancel_date: null,
      cancellation_completed_at: null,
      cancellation_proof: null,
      reminder_settings: {
        enabled: true,
        offset_days: 7,
        state: 'enabled',
      },
      evidence_records: [evidence()],
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
      ...overrides,
    },
  }
}

describe('canonical reminder management', () => {
  it('derives reminder trigger precedence without persisting a trigger date', () => {
    expect(
      getReminderTrigger(
        record({
          cancellation_status: 'planned',
          planned_cancel_date: '2026-07-20',
          renewal_status: 'auto_renew_on',
          next_charge_date: '2026-08-01',
          membership_end_date: '2026-09-01',
        }),
      ),
    ).toEqual({
      status: 'available',
      type: 'planned_cancellation',
      date: '2026-07-20',
      label: 'planned cancellation',
    })

    expect(
      getReminderTrigger(
        record({
          cancellation_status: 'confirmed',
          planned_cancel_date: '2026-07-20',
          renewal_status: 'auto_renew_on',
          next_charge_date: '2026-08-01',
          membership_end_date: '2026-09-01',
        }),
      ),
    ).toMatchObject({
      type: 'next_charge',
      date: '2026-08-01',
    })

    expect(getReminderTrigger(record({ membership_end_date: '2026-09-01' }))).toMatchObject({
      type: 'membership_end',
      date: '2026-09-01',
    })

    expect(getReminderTrigger(record())).toEqual({
      status: 'unavailable',
      type: 'unavailable',
      date: null,
      label: 'date unavailable',
    })
  })

  it('updates canonical reminder settings while preserving evidence and other facts', () => {
    const current = record({
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-08-01',
    })

    const result = buildReminderUpdate(current, {
      enabled: true,
      offsetDays: 3,
      updatedAt: UPDATED_AT,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.record.facts.reminder_settings).toEqual({
      enabled: true,
      offset_days: 3,
      state: 'enabled',
    })
    expect(result.record.facts.updated_at).toBe(UPDATED_AT)
    expect(result.record.facts.created_at).toBe(CREATED_AT)
    expect(result.record.facts.evidence_records).toEqual(current.facts.evidence_records)
    expect(result.record.facts.renewal_status).toBe('auto_renew_on')
    expect('reminder_trigger_date' in result.record.facts).toBe(false)
  })

  it('rejects invalid offsets without changing the record', () => {
    const current = record()

    expect(buildReminderUpdate(current, { enabled: true, offsetDays: -1, updatedAt: UPDATED_AT })).toEqual({
      ok: false,
      error: 'invalid_offset',
      record: current,
    })

    expect(buildReminderUpdate(current, { enabled: true, offsetDays: 1.5, updatedAt: UPDATED_AT })).toEqual({
      ok: false,
      error: 'invalid_offset',
      record: current,
    })
  })
})
