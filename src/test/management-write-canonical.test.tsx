import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import {
  CURRENT_SCHEMA_VERSION,
  type EvidenceRecord,
  type StorageEnvelope,
  type SubscriptionFacts,
  type SubscriptionRecord,
} from '../types'

const CREATED_AT = '2026-07-01T00:00:00.000Z'

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
        extracted_value: 'Account > Membership',
        source_text: 'Account > Membership',
        evidence_type: 'inferred',
        review_status: 'needs_review',
        is_inferred: true,
        user_confirmed: false,
        confirmed_at: null,
      },
    ],
  }
}

function record(id: string, overrides: Partial<SubscriptionFacts> = {}): SubscriptionRecord {
  return {
    facts: {
      id,
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

function seed(records: SubscriptionRecord[]) {
  localStorage.setItem(
    'subclear_subscriptions',
    JSON.stringify({
      schema_version: CURRENT_SCHEMA_VERSION,
      records,
    }),
  )
}

function readRecord(id: string): SubscriptionRecord {
  const envelope = JSON.parse(
    localStorage.getItem('subclear_subscriptions') ?? '{}',
  ) as StorageEnvelope<SubscriptionRecord>
  const found = envelope.records.find((item) => item.facts.id === id)
  if (!found) throw new Error(`Missing record ${id}`)
  return found
}

describe('Batch 4C canonical management write-side synchronization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ReminderSettings reads canonical trigger semantics and saves canonical reminder facts', async () => {
    const user = userEvent.setup()
    vi.setSystemTime(new Date('2026-07-15T10:00:00.000Z'))
    seed([
      record('reminder_001', {
        service_name: 'Membership End Only',
        renewal_status: 'manual_renewal',
        next_charge_date: null,
        membership_end_date: '2026-08-30',
      }),
    ])

    window.location.hash = '#/subscription/reminder_001/reminder'
    render(<App />)

    expect(screen.getByText(/会员到期：/)).toBeInTheDocument()

    const offsetInput = screen.getByRole('spinbutton', { name: /提前几天提醒/ })
    await user.clear(offsetInput)
    await user.type(offsetInput, '3')
    await user.click(screen.getByRole('button', { name: '保存提醒' }))

    await waitFor(() => {
      const updated = readRecord('reminder_001')
      expect(updated.facts.reminder_settings).toEqual({
        enabled: true,
        offset_days: 3,
        state: 'enabled',
      })
      expect(updated.facts.evidence_records).toHaveLength(1)
      expect(updated.facts.next_charge_date).toBeNull()
      expect('reminder_trigger_date' in updated.facts).toBe(false)
    })
  })

  it('Cancellation page creates and confirms a lightweight cancellation plan from canonical facts', async () => {
    const user = userEvent.setup()
    vi.setSystemTime(new Date('2026-07-15T10:00:00.000Z'))
    seed([
      record('cancel_001', {
        service_name: 'Apple Music',
        platform: 'App Store',
        renewal_status: 'auto_renew_on',
        next_charge_date: '2026-09-01',
        renewal_price: 12,
        currency: 'CNY',
        billing_cycle: 'monthly',
        membership_end_date: '2026-09-01',
        cancellation_path: 'Legacy account path',
        cancellation_steps: ['Legacy step'],
      }),
    ])

    window.location.hash = '#/subscription/cancel_001/cancellation'
    render(<App />)

    expect(screen.getByRole('heading', { name: '计划取消' })).toBeInTheDocument()
    expect(screen.queryByLabelText('取消路径')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('取消步骤')).not.toBeInTheDocument()
    expect(screen.getByText('App Store')).toBeInTheDocument()
    expect(screen.getByText('2026年9月1日')).toBeInTheDocument()
    expect(screen.getByText('CNY 12.00 / 每月')).toBeInTheDocument()
    const plannedDateInput = screen.getByLabelText('计划取消日期')
    expect(plannedDateInput).toHaveValue('2026-08-31')

    await user.clear(plannedDateInput)
    await user.type(plannedDateInput, '2026-08-30')
    await user.selectOptions(screen.getByLabelText('提前提醒'), '2')
    await user.click(screen.getByRole('button', { name: '创建取消计划' }))

    await waitFor(() => {
      const planned = readRecord('cancel_001')
      expect(planned.facts.cancellation_status).toBe('planned')
      expect(planned.facts.planned_cancel_date).toBe('2026-08-30')
      expect(planned.facts.reminder_settings.offset_days).toBe(2)
      expect(planned.facts.cancellation_path).toBe('Legacy account path')
      expect(planned.facts.cancellation_steps).toEqual(['Legacy step'])
      expect(planned.facts.evidence_records).toHaveLength(1)
    })

    expect(screen.getByText('待取消')).toBeInTheDocument()
    expect(screen.getByText('提前 2 天')).toBeInTheDocument()
    expect(screen.getByText('2026年8月28日')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '修改计划' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '标记已取消' }))
    expect(screen.getByRole('dialog', { name: '确认已经在原平台完成取消？' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(readRecord('cancel_001').facts.cancellation_status).toBe('planned')

    await user.click(screen.getByRole('button', { name: '标记已取消' }))
    await user.click(screen.getByRole('button', { name: '确认已取消' }))

    await waitFor(() => {
      const confirmed = readRecord('cancel_001')
      expect(confirmed.facts.cancellation_status).toBe('confirmed')
      expect(confirmed.facts.cancellation_completed_at).toBe('2026-07-15')
      expect(confirmed.facts.renewal_status).toBe('auto_renew_off')
      expect(confirmed.facts.membership_end_date).toBe('2026-09-01')
      expect(confirmed.facts.next_charge_date).toBe('2026-09-01')
      expect(confirmed.facts.renewal_price).toBe(12)
      expect(confirmed.facts.evidence_records[0]?.extracted_fields[0]?.review_status).toBe('needs_review')
    })
  }, 10_000)

  it('leaves the plan date empty when there is no canonical next charge date', () => {
    seed([
      record('no_next_charge_001', {
        service_name: 'No Next Charge',
        next_charge_date: null,
      }),
    ])

    window.location.hash = '#/subscription/no_next_charge_001/cancellation'
    render(<App />)

    expect(screen.getAllByText('未记录').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('计划取消日期')).toHaveValue('')
  })

  it('does not expose legacy cancellation path controls on the user-facing plan page', () => {
    seed([
      record('legacy_path_001', {
        service_name: 'Legacy Path',
        cancellation_status: 'planned',
        cancellation_path: 'https://example.com/account/cancel',
        cancellation_steps: ['Open account', 'Cancel renewal'],
        planned_cancel_date: '2026-07-20',
      }),
    ])

    window.location.hash = '#/subscription/legacy_path_001/cancellation'
    render(<App />)

    expect(screen.queryByRole('button', { name: '打开取消页面' })).not.toBeInTheDocument()
    expect(screen.queryByText('https://example.com/account/cancel')).not.toBeInTheDocument()
    expect(screen.queryByText('Open account')).not.toBeInTheDocument()
    expect(readRecord('legacy_path_001').facts.cancellation_status).toBe('planned')
  })

  it('does not false-save ReminderSettings when canonical persistence fails', async () => {
    const user = userEvent.setup()
    seed([
      record('failure_001', {
        service_name: 'Failure Reminder',
        membership_end_date: '2026-08-30',
        reminder_settings: {
          enabled: true,
          offset_days: 7,
          state: 'enabled',
        },
      }),
    ])

    window.location.hash = '#/subscription/failure_001/reminder'
    render(<App />)

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    const offsetInput = screen.getByRole('spinbutton', { name: /提前几天提醒/ })
    await user.clear(offsetInput)
    await user.type(offsetInput, '2')
    await user.click(screen.getByRole('button', { name: '保存提醒' }))

    expect(await screen.findByText(/提醒无法保存/)).toBeInTheDocument()
    setItemSpy.mockRestore()
    expect(readRecord('failure_001').facts.reminder_settings.offset_days).toBe(7)
  })
})
