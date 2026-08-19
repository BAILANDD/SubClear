import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import {
  CURRENT_SCHEMA_VERSION,
  type EvidenceRecord,
  type StorageEnvelope,
  type SubscriptionFacts,
  type SubscriptionRecord,
} from '../types'

const CREATED_AT = '2026-07-01T00:00:00.000Z'

function evidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
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
        field_name: 'renewal_status',
        extracted_value: 'auto_renew_on',
        source_text: 'Renews automatically',
        evidence_type: 'inferred',
        review_status: 'needs_review',
        is_inferred: true,
        user_confirmed: false,
        confirmed_at: null,
      },
    ],
    ...overrides,
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
  localStorage.setItem(
    'subclear_subscriptions',
    JSON.stringify({
      schema_version: CURRENT_SCHEMA_VERSION,
      records,
    }),
  )
}

describe('Batch 4A management read-side synchronization', () => {
  it('renders action-first Dashboard counts from canonical records and navigates to filtered list', async () => {
    const user = userEvent.setup()
    vi.setSystemTime(new Date('2026-07-15T10:00:00.000Z'))
    seed([
      record('needs_review', {
        service_name: 'Review Video',
        evidence_records: [evidence()],
      }),
      record('expiring', {
        service_name: 'Expiring Cloud',
        membership_end_date: '2026-07-18',
      }),
      record('charge', {
        service_name: 'Charge Music',
        renewal_status: 'auto_renew_on',
        next_charge_date: '2026-08-01',
      }),
      record('cancel', {
        service_name: 'Cancel Gym',
        cancellation_status: 'planned',
        planned_cancel_date: '2026-07-20',
      }),
    ])

    window.location.hash = '#/'
    render(<App />)

    const dashboard = screen.getByRole('main')
    expect(within(dashboard).queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument()
    expect(within(dashboard).getByTestId('home-page-intro')).toBeInTheDocument()
    expect(
      within(dashboard).getByText('See what renews, what needs review, and what can wait.'),
    ).toBeInTheDocument()
    expect(within(dashboard).queryByText('CONTROL ROOM')).not.toBeInTheDocument()
    expect(within(dashboard).queryByText('Dashboard')).not.toBeInTheDocument()
    expect(within(dashboard).queryByText('控制室')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /待确认，1 条记录/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /即将到期，1 条记录/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /即将扣费，1 条记录/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /取消计划，1 条记录/ })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /即将扣费，1 条记录/ }))

    expect(window.location.hash).toContain('/subscriptions?filter=upcoming_charges')
    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()
    expect(screen.getByText('Charge Music')).toBeInTheDocument()
    expect(screen.queryByText('Review Video')).not.toBeInTheDocument()
  })

  it('restores list filters from query, separates badges, and falls back invalid filters to All', async () => {
    vi.setSystemTime(new Date('2026-07-15T10:00:00.000Z'))
    seed([
      record('active_auto_off', {
        service_name: 'Readable News',
        plan_name: 'Annual',
        membership_end_date: '2026-09-01',
        renewal_status: 'auto_renew_off',
      }),
      record('confirmed_future', {
        service_name: 'Cancelled But Active',
        membership_end_date: '2026-08-01',
        cancellation_status: 'confirmed',
      }),
      record('expired', {
        service_name: 'Old Storage',
        membership_end_date: '2026-07-01',
      }),
    ])

    window.location.hash = '#/subscriptions?filter=expired'
    render(<App />)

    expect(screen.getByRole('button', { name: '已过期' })).toHaveClass('bg-blue-600')
    expect(screen.getByText('Old Storage')).toBeInTheDocument()
    expect(screen.queryByText('Readable News')).not.toBeInTheDocument()

    cleanup()
    window.location.hash = '#/subscriptions?filter=not_real'
    render(<App />)

    expect(screen.getAllByRole('button', { name: '全部' })[0]).toHaveClass('bg-blue-600')
    expect(screen.getAllByText('Readable News')[0]).toBeInTheDocument()
    expect(screen.getAllByText('有效')[0]).toBeInTheDocument()
    expect(screen.getAllByText('自动续费已关闭')[0]).toBeInTheDocument()
    expect(screen.getAllByText('已确认取消')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Cancelled But Active')[0]).toBeInTheDocument()
  })

  it('renders canonical Subscription Detail without the user-facing evidence workflow', () => {
    vi.setSystemTime(new Date('2026-07-15T10:00:00.000Z'))
    seed([
      record('detail_001', {
        service_name: 'Aurora Plus',
        plan_name: 'VIP Monthly',
        category: 'Entertainment',
        platform: 'iOS',
        entitlement_type: 'paid_membership',
        membership_start_date: '2026-07-01',
        membership_end_date: '2026-07-18',
        renewal_status: 'auto_renew_on',
        next_charge_date: '2026-08-01',
        renewal_price: 28,
        currency: 'CNY',
        billing_cycle: 'monthly',
        cancellation_status: 'planned',
        cancellation_path: 'App > Membership > Manage',
        cancellation_steps: ['Open membership center', 'Turn off auto-renew'],
        cancellation_deadline: '2026-07-31',
        planned_cancel_date: '2026-07-20',
        reminder_settings: {
          enabled: true,
          offset_days: 7,
          state: 'enabled',
        },
        evidence_records: [evidence()],
      }),
    ])

    window.location.hash = '#/subscription/detail_001'
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Aurora Plus' })).toBeInTheDocument()
    expect(screen.getByText('VIP Monthly')).toBeInTheDocument()
    expect(screen.getByText(/Entertainment/)).toBeInTheDocument()
    expect(screen.getByText(/iOS/)).toBeInTheDocument()
    expect(screen.queryByText('待确认')).not.toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '会员权益' })).toBeInTheDocument()
    expect(screen.getAllByText('即将到期')[0]).toBeInTheDocument()
    expect(screen.getByText('还剩 3 天')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '续费信息' })).toBeInTheDocument()
    expect(screen.getAllByText('自动续费')[0]).toBeInTheDocument()
    expect(screen.getByText('下次自动扣费')).toBeInTheDocument()
    expect(screen.getByText('CNY 28.00 / 每月')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '提醒' })).toBeInTheDocument()
    expect(screen.getByText(/模拟提醒已开启/)).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '取消计划' })).toBeInTheDocument()
    expect(screen.getByText('待取消')).toBeInTheDocument()

    expect(screen.queryByRole('heading', { name: '证据' })).not.toBeInTheDocument()
    expect(screen.queryByText(/1 条证据记录/)).not.toBeInTheDocument()
    expect(screen.queryByText(/未解决字段/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /核对证据/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /解决/ })).not.toBeInTheDocument()
  })

  it('renders missing Detail facts with field-specific semantics instead of generic unknown values', () => {
    vi.setSystemTime(new Date('2026-07-15T10:00:00.000Z'))
    seed([
      record('semantic_001', {
        service_name: 'Semantic Service',
        category: null,
        platform: null,
        membership_start_date: null,
        membership_end_date: null,
        renewal_status: 'unknown',
        next_charge_date: null,
        renewal_price: 10,
        currency: 'USD',
        billing_cycle: 'monthly',
        cancellation_status: 'none',
        cancellation_path: 'Account > Billing',
        cancellation_steps: ['Open billing'],
      }),
    ])
    const persistedBeforeRender = localStorage.getItem('subclear_subscriptions')

    window.location.hash = '#/subscription/semantic_001'
    render(<App />)

    expect(screen.getByText('分类：未分类 · 订阅渠道：未记录')).toBeInTheDocument()
    expect(screen.queryByText('分类 / 平台未知')).not.toBeInTheDocument()
    expect(screen.getByText('续费未确认')).toBeInTheDocument()

    const membershipModule = screen.getByRole('heading', { name: '会员权益' }).closest('section')
    expect(membershipModule).not.toBeNull()
    expect(within(membershipModule!).getByText('开始日期').parentElement).toHaveTextContent('未记录')
    expect(within(membershipModule!).getByText('结束日期').parentElement).toHaveTextContent('未记录')
    expect(within(membershipModule!).getByText('剩余时间').parentElement).toHaveTextContent('无法计算')

    const renewalModule = screen.getByRole('heading', { name: '续费信息' }).closest('section')
    expect(renewalModule).not.toBeNull()
    expect(within(renewalModule!).getByText('续费状态').parentElement).toHaveTextContent('未确认')
    expect(within(renewalModule!).getByText('下次自动扣费').parentElement).toHaveTextContent(
      '续费状态未确认',
    )
    expect(within(renewalModule!).getByText('价格').parentElement).toHaveTextContent('USD 10.00 / 每月')

    const cancellationModule = screen.getByRole('heading', { name: '取消计划' }).closest('section')
    expect(cancellationModule).not.toBeNull()
    expect(within(cancellationModule!).getByText('没有取消计划')).toBeInTheDocument()
    expect(within(cancellationModule!).queryByText('Account > Billing')).not.toBeInTheDocument()
    expect(within(cancellationModule!).queryByText('已保存 1 个步骤')).not.toBeInTheDocument()
    expect(within(cancellationModule!).queryByText('截止日期')).not.toBeInTheDocument()
    expect(within(cancellationModule!).queryByText('计划取消日期')).not.toBeInTheDocument()
    expect(within(cancellationModule!).queryByText('完成时间')).not.toBeInTheDocument()

    expect(screen.getByText('当前 demo 中的提醒为模拟状态。')).toBeInTheDocument()
    expect(screen.queryByText('没有已捕获证据。')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回记录列表' })).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: '主导航' })).getAllByRole('link')).toHaveLength(2)
    expect(localStorage.getItem('subclear_subscriptions')).toBe(persistedBeforeRender)
  })

  it('keeps existing Reminder and Cancellation routes reachable while preserving canonical evidence', async () => {
    const user = userEvent.setup()
    vi.setSystemTime(new Date('2026-07-15T10:00:00.000Z'))
    seed([
      record('compat_001', {
        service_name: 'Compat Service',
        renewal_status: 'auto_renew_on',
        next_charge_date: '2026-08-01',
        cancellation_status: 'planned',
        cancellation_path: 'Account > Membership',
        planned_cancel_date: '2026-07-20',
        evidence_records: [evidence()],
      }),
    ])

    window.location.hash = '#/subscription/compat_001/reminder'
    render(<App />)
    expect(screen.getByRole('heading', { name: '提醒设置' })).toBeInTheDocument()

    cleanup()
    window.location.hash = '#/subscription/compat_001/cancellation'
    render(<App />)
    expect(screen.getByRole('heading', { name: '计划取消' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '标记已取消' }))
    await user.click(screen.getByRole('button', { name: '确认已取消' }))

    await waitFor(() => {
      const envelope = JSON.parse(
        localStorage.getItem('subclear_subscriptions') ?? '{}',
      ) as StorageEnvelope<SubscriptionRecord>
      const updated = envelope.records.find((item) => item.facts.id === 'compat_001')
      expect(updated?.facts.cancellation_status).toBe('confirmed')
      expect(updated?.facts.evidence_records).toHaveLength(1)
      expect(updated?.facts.evidence_records[0]?.extracted_fields).toHaveLength(1)
    })
  })
})
