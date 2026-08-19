import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'
import {
  CURRENT_SCHEMA_VERSION,
  type StorageEnvelope,
  type SubscriptionFacts,
  type SubscriptionRecord,
} from '../types'

const CREATED_AT = '2026-07-01T00:00:00.000Z'

function record(id: string, overrides: Partial<SubscriptionFacts> = {}): SubscriptionRecord {
  return {
    facts: {
      id,
      service_name: 'Quiet Service',
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

describe('Home Right Now CTA', () => {
  it('does not render a hero CTA when the current selector total is zero', () => {
    seed([record('quiet_001')])
    window.location.hash = '#/'

    const { container } = render(<App />)

    const summary = screen.getByRole('region', { name: '待处理摘要' })
    expect(within(summary).getByText('0')).toBeInTheDocument()
    expect(within(summary).queryByRole('link', { name: '查看待处理事项' })).not.toBeInTheDocument()
    expect(within(summary).queryByRole('button', { name: /添加记录/ })).not.toBeInTheDocument()
    expect(container.querySelector('.hero-add-button')).toBeNull()
    expect(screen.getByText('无需连接银行。SubClear 只记录会员信息和任务。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /待确认，0 条记录/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /即将到期，0 条记录/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /即将扣费，0 条记录/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /取消计划，0 条记录/ })).toBeInTheDocument()
    expect(screen.getByText('当前没有紧急事项。')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
  })
})
