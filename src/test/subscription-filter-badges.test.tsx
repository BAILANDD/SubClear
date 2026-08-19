import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
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
    field_name: 'renewal_status',
    extracted_value: 'auto_renew_on',
    source_text: 'Renews automatically',
    evidence_type: 'inferred',
    review_status: 'needs_review',
    is_inferred: true,
    user_confirmed: false,
    confirmed_at: null,
    ...overrides,
  }
}

function evidence(fields: FieldEvidence[] = [field()]): EvidenceRecord {
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

function record(id: string, overrides: Partial<SubscriptionFacts> = {}): SubscriptionRecord {
  return {
    facts: {
      id,
      service_name: `Service ${id}`,
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
      evidence_records: [],
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
      ...overrides,
    },
  }
}

function seed(records: SubscriptionRecord[]) {
  const envelope: StorageEnvelope<SubscriptionRecord> = {
    schema_version: CURRENT_SCHEMA_VERSION,
    records,
  }
  localStorage.setItem('subclear_subscriptions', JSON.stringify(envelope))
}

function records(count: number, createRecord: (index: number) => SubscriptionRecord) {
  return Array.from({ length: count }, (_, index) => createRecord(index + 1))
}

describe('My Subscriptions filter notification badges', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows badges only on non-zero action filters in the default fixture', () => {
    window.location.hash = '#/subscriptions'

    render(<App />)

    const filterRail = screen.getByLabelText('记录筛选')
    expect(within(filterRail).getByTestId('filter-badge-expiring_soon')).toHaveTextContent('1')
    expect(within(filterRail).getByTestId('filter-badge-cancellation_tasks')).toHaveTextContent(
      '1',
    )
    expect(within(filterRail).queryByTestId('filter-badge-needs_review')).not.toBeInTheDocument()
    expect(
      within(filterRail).queryByTestId('filter-badge-upcoming_charges'),
    ).not.toBeInTheDocument()
    expect(within(filterRail).queryByTestId('filter-badge-all')).not.toBeInTheDocument()
    expect(within(filterRail).queryByTestId('filter-badge-auto_renew_on')).not.toBeInTheDocument()
    expect(within(filterRail).queryByTestId('filter-badge-expired')).not.toBeInTheDocument()
  })

  it('uses the same filter results as badge counts and keeps chip clicks working', async () => {
    const user = userEvent.setup()
    vi.setSystemTime(new Date('2026-08-05T10:00:00.000Z'))
    seed([
      record('needs_review', {
        service_name: 'Needs Review Service',
        evidence_records: [evidence()],
      }),
      record('expiring', {
        service_name: 'Expiring Service',
        membership_end_date: '2026-08-10',
      }),
      record('upcoming', {
        service_name: 'Upcoming Charge Service',
        renewal_status: 'auto_renew_on',
        next_charge_date: '2026-08-15',
      }),
      record('cancel', {
        service_name: 'Cancellation Service',
        cancellation_status: 'planned',
        planned_cancel_date: '2026-08-12',
      }),
      record('auto_renew', {
        service_name: 'Auto Renew Collection Service',
        renewal_status: 'auto_renew_on',
        next_charge_date: '2026-11-01',
      }),
      record('expired', {
        service_name: 'Expired Collection Service',
        membership_end_date: '2026-07-01',
      }),
    ])
    window.location.hash = '#/subscriptions'

    render(<App />)

    const filterRail = screen.getByLabelText('记录筛选')
    expect(within(filterRail).getByTestId('filter-badge-needs_review')).toHaveTextContent('1')
    expect(within(filterRail).getByTestId('filter-badge-expiring_soon')).toHaveTextContent('1')
    expect(within(filterRail).getByTestId('filter-badge-upcoming_charges')).toHaveTextContent('1')
    expect(within(filterRail).getByTestId('filter-badge-cancellation_tasks')).toHaveTextContent(
      '1',
    )
    expect(within(filterRail).queryByTestId('filter-badge-all')).not.toBeInTheDocument()
    expect(within(filterRail).queryByTestId('filter-badge-auto_renew_on')).not.toBeInTheDocument()
    expect(within(filterRail).queryByTestId('filter-badge-expired')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '即将到期，1 条记录' })).toBeInTheDocument()

    await user.click(within(filterRail).getByTestId('filter-badge-expiring_soon'))

    expect(window.location.hash).toContain('/subscriptions?filter=expiring_soon')
    const activeChip = screen.getByRole('button', { name: '即将到期，1 条记录' })
    expect(activeChip).toHaveClass('is-selected')
    expect(within(activeChip).getByTestId('filter-badge-expiring_soon')).toHaveTextContent('1')
    expect(screen.getByText('Expiring Service')).toBeInTheDocument()
    expect(screen.queryByText('Needs Review Service')).not.toBeInTheDocument()
  })

  it('formats large badge counts without changing the underlying accessible count', () => {
    seed([
      ...records(99, (index) =>
        record(`cancel_${index}`, {
          service_name: `Cancel ${index}`,
          cancellation_status: 'planned',
        }),
      ),
      ...records(100, (index) =>
        record(`review_${index}`, {
          service_name: `Review ${index}`,
          evidence_records: [evidence()],
        }),
      ),
    ])
    window.location.hash = '#/subscriptions'

    render(<App />)

    const filterRail = screen.getByLabelText('记录筛选')
    expect(within(filterRail).getByTestId('filter-badge-cancellation_tasks')).toHaveTextContent(
      '99',
    )
    expect(within(filterRail).getByTestId('filter-badge-needs_review')).toHaveTextContent('99+')
    expect(screen.getByRole('button', { name: '取消计划，99 条记录' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '待确认，100 条记录' })).toBeInTheDocument()
  })
})
