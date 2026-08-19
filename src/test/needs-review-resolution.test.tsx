import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import {
  CURRENT_SCHEMA_VERSION,
  type EvidenceRecord,
  type FieldEvidence,
  type StorageEnvelope,
  type SubscriptionFacts,
  type SubscriptionRecord,
} from '../types'

const CREATED_AT = '2026-07-01T00:00:00.000Z'

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

function evidenceRecord(fields: FieldEvidence[]): EvidenceRecord {
  return {
    evidence_id: 'evidence_001',
    source_type: 'in_app_membership',
    file_name: 'membership.png',
    fixture_reference: null,
    extraction_method: 'fixture',
    processing_status: 'completed',
    created_at: CREATED_AT,
    extracted_fields: fields,
  }
}

function record(overrides: Partial<SubscriptionFacts> = {}): SubscriptionRecord {
  return {
    facts: {
      id: 'review_001',
      service_name: 'Aurora Plus',
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
      evidence_records: [evidenceRecord([field()])],
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
      ...overrides,
    },
  }
}

function seed(records: SubscriptionRecord[]) {
  localStorage.setItem(
    'subclear_subscriptions',
    JSON.stringify({
      schema_version: CURRENT_SCHEMA_VERSION,
      records,
    }),
  )
}

describe('Needs Review entry after AI-assisted form reconciliation', () => {
  it('opens ordinary Detail from the Needs Review list without the old evidence workflow', async () => {
    const user = userEvent.setup()
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'))
    seed([record()])

    window.location.hash = '#/subscriptions?filter=needs_review'
    render(<App />)

    await user.click(screen.getByText('Aurora Plus'))

    await waitFor(() => expect(window.location.hash).toBe('#/subscription/review_001'))
    expect(screen.getByRole('heading', { name: 'Aurora Plus' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '证据' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /核对证据/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('evidence-review-view')).not.toBeInTheDocument()
  })

  it('ignores legacy focus=evidence query while preserving embedded evidence metadata', () => {
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'))
    seed([record()])

    window.location.hash = '#/subscription/review_001?focus=evidence'
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Aurora Plus' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '证据' })).not.toBeInTheDocument()
    expect(screen.queryByText(/待确认：1 个未解决字段/)).not.toBeInTheDocument()

    const envelope = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as StorageEnvelope<SubscriptionRecord>
    expect(envelope.records[0]?.facts.evidence_records).toHaveLength(1)
    expect(envelope.records[0]?.facts.evidence_records[0]?.extracted_fields).toHaveLength(1)
  })
})
