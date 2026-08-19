import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, type EvidenceRecord, type SubscriptionFacts, type SubscriptionRecord } from '../types'
import {
  buildCancellationConfirmation,
  buildCancellationPlan,
  buildCancellationUpdate,
  getCancellationReminderDate,
  getDefaultPlannedCancelDate,
  getSafeExternalCancellationUrl,
  stepsFromText,
  stepsToText,
} from '../cancellation/cancellationManagement'
import { deriveMembershipStatus } from '../domain/derived'
import { getReminderTrigger } from '../reminder/reminderManagement'
import { deriveDashboardCounts, isActiveCancellationTask } from '../selectors/subscriptions'

const CREATED_AT = '2026-07-01T00:00:00.000Z'
const UPDATED_AT = '2026-07-15T10:00:00.000Z'

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
        extracted_value: 'Account > Renewal',
        source_text: 'Account > Renewal',
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
      membership_end_date: '2026-08-30',
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-08-01',
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

describe('canonical cancellation management', () => {
  it('builds a lightweight cancellation plan without rewriting legacy path or steps', () => {
    const current = record({
      cancellation_path: 'Legacy account path',
      cancellation_steps: ['Legacy step'],
      next_charge_date: '2026-08-01',
      reminder_settings: {
        enabled: true,
        offset_days: 7,
        state: 'enabled',
      },
    })

    const planned = buildCancellationPlan(current, {
      plannedDate: '2026-07-31',
      reminderLeadDays: 2,
      updatedAt: UPDATED_AT,
    })

    expect(planned.ok).toBe(true)
    if (!planned.ok) return

    expect(planned.record.facts.cancellation_status).toBe('planned')
    expect(planned.record.facts.planned_cancel_date).toBe('2026-07-31')
    expect(planned.record.facts.reminder_settings).toEqual({
      enabled: true,
      offset_days: 2,
      state: 'enabled',
    })
    expect(planned.record.facts.cancellation_path).toBe('Legacy account path')
    expect(planned.record.facts.cancellation_steps).toEqual(['Legacy step'])
    expect(planned.record.facts.cancellation_completed_at).toBeNull()
    expect(planned.record.facts.renewal_status).toBe('auto_renew_on')
    expect(planned.record.facts.membership_end_date).toBe('2026-08-30')
    expect(planned.record.facts.evidence_records).toEqual(current.facts.evidence_records)
    expect(isActiveCancellationTask(planned.record)).toBe(true)
    expect(
      deriveDashboardCounts([planned.record], {
        referenceDate: '2026-07-15',
        upcomingChargeWindowDays: 30,
      }).cancellationTasks,
    ).toBe(1)
  })

  it('rejects invalid lightweight cancellation plan input without changing the record', () => {
    const current = record()

    expect(
      buildCancellationPlan(current, {
        plannedDate: '',
        reminderLeadDays: 1,
        updatedAt: UPDATED_AT,
      }),
    ).toEqual({
      ok: false,
      error: 'invalid_date',
      record: current,
    })

    expect(
      buildCancellationPlan(current, {
        plannedDate: '2026-07-20',
        reminderLeadDays: 5,
        updatedAt: UPDATED_AT,
      }),
    ).toEqual({
      ok: false,
      error: 'invalid_reminder_lead',
      record: current,
    })
  })

  it('derives lightweight cancellation plan dates from canonical renewal facts', () => {
    expect(getDefaultPlannedCancelDate('2026-09-01')).toBe('2026-08-31')
    expect(getDefaultPlannedCancelDate(null)).toBeNull()
    expect(getDefaultPlannedCancelDate('not-a-date')).toBeNull()

    expect(getCancellationReminderDate('2026-08-31', 0)).toBe('2026-08-31')
    expect(getCancellationReminderDate('2026-08-31', 2)).toBe('2026-08-29')
    expect(getCancellationReminderDate('', 1)).toBeNull()
  })

  it('confirms a cancellation plan without marking the membership expired or deleting the record', () => {
    const current = record({
      cancellation_status: 'planned',
      planned_cancel_date: '2026-07-20',
      cancellation_path: 'Legacy account path',
      cancellation_steps: ['Legacy step'],
    })

    const confirmed = buildCancellationConfirmation(current, {
      updatedAt: UPDATED_AT,
    })

    expect(confirmed.ok).toBe(true)
    if (!confirmed.ok) return

    expect(confirmed.record.facts.id).toBe(current.facts.id)
    expect(confirmed.record.facts.cancellation_status).toBe('confirmed')
    expect(confirmed.record.facts.cancellation_completed_at).toBe('2026-07-15')
    expect(confirmed.record.facts.renewal_status).toBe('auto_renew_off')
    expect(confirmed.record.facts.membership_end_date).toBe('2026-08-30')
    expect(confirmed.record.facts.cancellation_path).toBe('Legacy account path')
    expect(confirmed.record.facts.cancellation_steps).toEqual(['Legacy step'])
    expect(isActiveCancellationTask(confirmed.record)).toBe(false)
    expect(
      deriveDashboardCounts([confirmed.record], {
        referenceDate: '2026-07-15',
        upcomingChargeWindowDays: 30,
      }).cancellationTasks,
    ).toBe(0)
    expect(getReminderTrigger(confirmed.record).type).not.toBe('planned_cancellation')
    expect(
      deriveMembershipStatus(confirmed.record.facts, {
        referenceDate: '2026-07-15',
        expiringSoonThresholdDays: 7,
      }),
    ).toBe('active')
  })

  it('updates cancellation task facts while preserving evidence and unrelated lifecycle facts', () => {
    const current = record()

    const planned = buildCancellationUpdate(current, {
      status: 'planned',
      path: 'Settings > Membership > Renewal',
      stepsText: 'Open settings\nTurn off renewal',
      deadline: '2026-07-31',
      plannedDate: '2026-07-20',
      proof: 'support note',
      updatedAt: UPDATED_AT,
    })

    expect(planned.ok).toBe(true)
    if (!planned.ok) return

    expect(planned.record.facts.cancellation_status).toBe('planned')
    expect(planned.record.facts.cancellation_path).toBe('Settings > Membership > Renewal')
    expect(planned.record.facts.cancellation_steps).toEqual(['Open settings', 'Turn off renewal'])
    expect(planned.record.facts.cancellation_deadline).toBe('2026-07-31')
    expect(planned.record.facts.planned_cancel_date).toBe('2026-07-20')
    expect(planned.record.facts.cancellation_completed_at).toBeNull()
    expect(planned.record.facts.cancellation_proof).toBe('support note')
    expect(planned.record.facts.renewal_status).toBe('auto_renew_on')
    expect(planned.record.facts.membership_end_date).toBe('2026-08-30')
    expect(planned.record.facts.evidence_records).toEqual(current.facts.evidence_records)
    expect(planned.record.facts.updated_at).toBe(UPDATED_AT)
    expect(isActiveCancellationTask(planned.record)).toBe(true)
  })

  it('marks active task confirmed without forcing membership expiry or renewal off', () => {
    const current = record({
      cancellation_status: 'in_progress',
      planned_cancel_date: '2026-07-20',
    })

    const confirmed = buildCancellationUpdate(current, {
      status: 'confirmed',
      path: 'https://example.com/account/cancel',
      stepsText: stepsToText(['Open account', 'Confirm cancellation']),
      deadline: '2026-07-31',
      plannedDate: '2026-07-20',
      proof: 'confirmation #123',
      updatedAt: UPDATED_AT,
    })

    expect(confirmed.ok).toBe(true)
    if (!confirmed.ok) return

    expect(confirmed.record.facts.cancellation_status).toBe('confirmed')
    expect(confirmed.record.facts.cancellation_completed_at).toBe('2026-07-15')
    expect(confirmed.record.facts.renewal_status).toBe('auto_renew_on')
    expect(confirmed.record.facts.membership_end_date).toBe('2026-08-30')
    expect(isActiveCancellationTask(confirmed.record)).toBe(false)
    expect(
      deriveMembershipStatus(confirmed.record.facts, {
        referenceDate: '2026-07-15',
        expiringSoonThresholdDays: 7,
      }),
    ).toBe('active')
  })

  it('keeps existing completion date when editing an already confirmed task', () => {
    const current = record({
      cancellation_status: 'confirmed',
      cancellation_completed_at: '2026-07-10',
    })

    const edited = buildCancellationUpdate(current, {
      status: 'confirmed',
      path: 'Account > Renewal',
      stepsText: '',
      deadline: '',
      plannedDate: '',
      proof: 'updated proof',
      updatedAt: UPDATED_AT,
    })

    expect(edited.ok).toBe(true)
    if (!edited.ok) return

    expect(edited.record.facts.cancellation_completed_at).toBe('2026-07-10')
    expect(edited.record.facts.cancellation_proof).toBe('updated proof')
  })

  it('parses steps and restricts external cancellation URL schemes', () => {
    expect(stepsFromText(' First step \n\n Second step ')).toEqual(['First step', 'Second step'])
    expect(stepsToText(['First step', 'Second step'])).toBe('First step\nSecond step')
    expect(getSafeExternalCancellationUrl('https://example.com/cancel')?.href).toBe(
      'https://example.com/cancel',
    )
    expect(getSafeExternalCancellationUrl('http://example.com/cancel')?.href).toBe(
      'http://example.com/cancel',
    )
    expect(getSafeExternalCancellationUrl('javascript:alert(1)')).toBeNull()
    expect(getSafeExternalCancellationUrl('data:text/plain,hello')).toBeNull()
    expect(getSafeExternalCancellationUrl('Settings > Membership > Renewal')).toBeNull()
  })
})
