import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS,
  deriveMembershipStatus,
  getRemainingDays,
} from '../domain/derived'
import {
  deriveDashboardCounts,
  filterSubscriptionRecords,
  isFieldEvidenceUnresolved,
  isRecordNeedsReview,
  selectAutoRenewOnRecords,
  selectCancellationTasks,
  selectNeedsReviewRecords,
  selectUpcomingCharges,
} from '../selectors/subscriptions'
import {
  CURRENT_SCHEMA_VERSION,
  type EvidenceRecord,
  type FieldEvidence,
  type SubscriptionFacts,
  type SubscriptionRecord,
} from '../types'

const REFERENCE_DATE = '2026-07-15'

function facts(overrides: Partial<SubscriptionFacts> = {}): SubscriptionFacts {
  return {
    id: 'record_001',
    service_name: 'Example Service',
    plan_name: null,
    category: null,
    platform: null,
    entitlement_type: 'paid_membership',
    membership_start_date: null,
    membership_end_date: '2026-08-30',
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
    },
    evidence_records: [],
    schema_version: CURRENT_SCHEMA_VERSION,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function field(overrides: Partial<FieldEvidence> = {}): FieldEvidence {
  return {
    field_name: 'service_name',
    extracted_value: 'Example Service',
    source_text: 'Example Service',
    evidence_type: 'direct',
    review_status: 'ready',
    is_inferred: false,
    user_confirmed: false,
    confirmed_at: null,
    ...overrides,
  }
}

function evidenceRecord(fields: FieldEvidence[]): EvidenceRecord {
  return {
    evidence_id: 'evidence_001',
    source_type: 'in_app_membership',
    fixture_reference: null,
    extraction_method: 'fixture',
    processing_status: 'completed',
    created_at: '2026-07-01T00:00:00.000Z',
    extracted_fields: fields,
  }
}

function record(id: string, overrides: Partial<SubscriptionFacts> = {}): SubscriptionRecord {
  return {
    facts: facts({
      id,
      ...overrides,
    }),
  }
}

describe('derived membership status', () => {
  it('returns unknown when membership_end_date is missing', () => {
    expect(
      deriveMembershipStatus(facts({ membership_end_date: null }), {
        referenceDate: REFERENCE_DATE,
      }),
    ).toBe('unknown')
  })

  it('derives status from membership facts and calendar-day thresholds only', () => {
    expect(
      deriveMembershipStatus(facts({ membership_end_date: 'not-a-date' }), {
        referenceDate: REFERENCE_DATE,
      }),
    ).toBe('unknown')
    expect(
      deriveMembershipStatus(facts({ membership_end_date: '2026-07-14' }), {
        referenceDate: REFERENCE_DATE,
      }),
    ).toBe('expired')
    expect(
      deriveMembershipStatus(facts({ membership_end_date: '2026-07-15' }), {
        referenceDate: REFERENCE_DATE,
      }),
    ).toBe('expiring_soon')
    expect(
      deriveMembershipStatus(facts({ membership_end_date: '2026-07-22' }), {
        referenceDate: REFERENCE_DATE,
        expiringSoonThresholdDays: DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS,
      }),
    ).toBe('expiring_soon')
    expect(
      deriveMembershipStatus(
        facts({ entitlement_type: 'trial', membership_end_date: '2026-07-23' }),
        {
          referenceDate: REFERENCE_DATE,
          expiringSoonThresholdDays: DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS,
        },
      ),
    ).toBe('trial')
    expect(
      deriveMembershipStatus(facts({ membership_end_date: '2026-07-23' }), {
        referenceDate: REFERENCE_DATE,
        expiringSoonThresholdDays: DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS,
      }),
    ).toBe('active')
  })

  it('keeps cancellation task status independent from membership status', () => {
    expect(
      deriveMembershipStatus(
        facts({ cancellation_status: 'confirmed', membership_end_date: '2026-07-30' }),
        { referenceDate: REFERENCE_DATE },
      ),
    ).toBe('active')
    expect(
      deriveMembershipStatus(
        facts({
          entitlement_type: 'trial',
          cancellation_status: 'confirmed',
          membership_end_date: '2026-07-30',
        }),
        { referenceDate: REFERENCE_DATE },
      ),
    ).toBe('trial')
    expect(
      deriveMembershipStatus(
        facts({ cancellation_status: 'none', membership_end_date: '2026-07-01' }),
        { referenceDate: REFERENCE_DATE },
      ),
    ).toBe('expired')
  })
})

describe('remaining days', () => {
  it('returns signed calendar-day differences without timezone shifts', () => {
    expect(getRemainingDays(facts({ membership_end_date: '2026-07-14' }), REFERENCE_DATE)).toBe(
      -1,
    )
    expect(getRemainingDays(facts({ membership_end_date: '2026-07-15' }), REFERENCE_DATE)).toBe(0)
    expect(getRemainingDays(facts({ membership_end_date: '2026-07-18' }), REFERENCE_DATE)).toBe(3)
    expect(getRemainingDays(facts({ membership_end_date: null }), REFERENCE_DATE)).toBeNull()
    expect(getRemainingDays(facts({ membership_end_date: '2026-02-31' }), REFERENCE_DATE)).toBeNull()
    expect(getRemainingDays(facts({ membership_end_date: '2026-07-16' }), '2026-07-15')).toBe(1)
  })
})

describe('needs review derivation', () => {
  it('separates unresolved FieldEvidence from resolved fields without using model confidence', () => {
    expect(isFieldEvidenceUnresolved(field())).toBe(true)
    expect(
      isFieldEvidenceUnresolved(
        field({ review_status: 'confirmed', user_confirmed: true, model_confidence: 0.1 }),
      ),
    ).toBe(false)
    expect(
      isFieldEvidenceUnresolved(
        field({ evidence_type: 'inferred', review_status: 'needs_review', is_inferred: true }),
      ),
    ).toBe(true)
    expect(isFieldEvidenceUnresolved(field({ evidence_type: 'missing', review_status: 'missing' })))
      .toBe(true)
    expect(isFieldEvidenceUnresolved(field({ evidence_type: 'conflict', review_status: 'conflict' })))
      .toBe(true)
    expect(
      isFieldEvidenceUnresolved(
        field({ evidence_type: 'user_edited', review_status: 'needs_review' }),
      ),
    ).toBe(true)
    expect(
      isFieldEvidenceUnresolved(
        field({
          evidence_type: 'user_edited',
          review_status: 'confirmed',
          user_confirmed: true,
        }),
      ),
    ).toBe(false)
  })

  it('selects saved records with unresolved evidence once and ignores empty evidence arrays', () => {
    const resolved = record('resolved', {
      evidence_records: [
        evidenceRecord([field({ review_status: 'confirmed', user_confirmed: true })]),
      ],
    })
    const emptyEvidence = record('empty-evidence')
    const multipleIssues = record('multiple-issues', {
      evidence_records: [
        evidenceRecord([
          field({ evidence_type: 'inferred', review_status: 'needs_review', is_inferred: true }),
          field({ evidence_type: 'missing', review_status: 'missing' }),
        ]),
      ],
    })

    expect(isRecordNeedsReview(emptyEvidence)).toBe(false)
    expect(selectNeedsReviewRecords([resolved, emptyEvidence, multipleIssues])).toEqual([
      multipleIssues,
    ])
  })
})

describe('subscription collection selectors', () => {
  const selectorOptions = {
    referenceDate: REFERENCE_DATE,
    expiringSoonThresholdDays: 7,
    upcomingChargeWindowDays: 7,
  }

  it('separates upcoming charges from auto-renew on records', () => {
    const todayCharge = record('today', {
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-07-15',
    })
    const withinWindow = record('within-window', {
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-07-20',
    })
    const exactlyWindow = record('exactly-window', {
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-07-22',
    })
    const afterWindow = record('after-window', {
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-07-23',
    })
    const noDate = record('no-date', {
      renewal_status: 'auto_renew_on',
      next_charge_date: null,
    })
    const autoRenewOff = record('off-with-date', {
      renewal_status: 'auto_renew_off',
      next_charge_date: '2026-07-18',
    })
    const pastCharge = record('past-charge', {
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-07-14',
    })
    const records = [todayCharge, withinWindow, exactlyWindow, afterWindow, noDate, autoRenewOff, pastCharge]

    expect(selectUpcomingCharges(records, selectorOptions)).toEqual([
      todayCharge,
      withinWindow,
      exactlyWindow,
    ])
    expect(selectAutoRenewOnRecords(records)).toEqual([
      todayCharge,
      withinWindow,
      exactlyWindow,
      afterWindow,
      noDate,
      pastCharge,
    ])
  })

  it('selects active cancellation tasks only', () => {
    const planned = record('planned', { cancellation_status: 'planned' })
    const inProgress = record('in-progress', { cancellation_status: 'in_progress' })
    const none = record('none', { cancellation_status: 'none' })
    const confirmed = record('confirmed', { cancellation_status: 'confirmed' })

    expect(selectCancellationTasks([planned, inProgress, none, confirmed])).toEqual([
      planned,
      inProgress,
    ])
  })

  it('derives dashboard counts from shared selectors without forcing exclusivity', () => {
    const multiAction = record('multi-action', {
      membership_end_date: '2026-07-18',
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-07-18',
    })
    const reviewWithMultipleFields = record('review', {
      evidence_records: [
        evidenceRecord([
          field({ evidence_type: 'inferred', review_status: 'needs_review', is_inferred: true }),
          field({ evidence_type: 'conflict', review_status: 'conflict' }),
        ]),
      ],
    })
    const cancellation = record('cancel', { cancellation_status: 'planned' })

    expect(deriveDashboardCounts([multiAction, reviewWithMultipleFields, cancellation], selectorOptions))
      .toEqual({
        needsReview: 1,
        expiringSoon: 1,
        upcomingCharges: 1,
        cancellationTasks: 1,
      })
  })

  it('filters records by shared list filter rules while preserving order and input', () => {
    const all = [
      record('all-base'),
      record('needs-review', {
        evidence_records: [evidenceRecord([field({ review_status: 'ready' })])],
      }),
      record('expiring', { membership_end_date: '2026-07-18' }),
      record('upcoming', {
        membership_end_date: '2026-07-18',
        renewal_status: 'auto_renew_on',
        next_charge_date: '2026-07-18',
      }),
      record('auto-renew', {
        renewal_status: 'auto_renew_on',
        next_charge_date: null,
      }),
      record('cancel-task', { cancellation_status: 'in_progress' }),
      record('expired', { membership_end_date: '2026-07-01' }),
    ]
    const before = JSON.parse(JSON.stringify(all)) as SubscriptionRecord[]

    expect(filterSubscriptionRecords(all, 'all', selectorOptions).map((item) => item.facts.id))
      .toEqual(all.map((item) => item.facts.id))
    expect(filterSubscriptionRecords(all, 'needs_review', selectorOptions).map((item) => item.facts.id))
      .toEqual(['needs-review'])
    expect(filterSubscriptionRecords(all, 'expiring_soon', selectorOptions).map((item) => item.facts.id))
      .toEqual(['expiring', 'upcoming'])
    expect(filterSubscriptionRecords(all, 'upcoming_charges', selectorOptions).map((item) => item.facts.id))
      .toEqual(['upcoming'])
    expect(filterSubscriptionRecords(all, 'auto_renew_on', selectorOptions).map((item) => item.facts.id))
      .toEqual(['upcoming', 'auto-renew'])
    expect(filterSubscriptionRecords(all, 'cancellation_tasks', selectorOptions).map((item) => item.facts.id))
      .toEqual(['cancel-task'])
    expect(filterSubscriptionRecords(all, 'expired', selectorOptions).map((item) => item.facts.id))
      .toEqual(['expired'])
    expect(all).toEqual(before)
  })

  it('is deterministic for the same reference date and changes predictably with reference date', () => {
    const trial = facts({ entitlement_type: 'trial', membership_end_date: '2026-07-23' })

    expect(deriveMembershipStatus(trial, { referenceDate: '2026-07-15' })).toBe('trial')
    expect(deriveMembershipStatus(trial, { referenceDate: '2026-07-15' })).toBe('trial')
    expect(deriveMembershipStatus(trial, { referenceDate: '2026-07-20' })).toBe('expiring_soon')
  })
})
