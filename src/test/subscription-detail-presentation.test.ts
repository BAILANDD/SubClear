import { describe, expect, it } from 'vitest'
import {
  formatDetailIdentity,
  formatRecordedDate,
  getCancellationDetailRows,
  getDetailRenewalPresentation,
} from '../presentation/subscriptionDetailPresentation'
import type { CancellationStatus, RenewalStatus, SubscriptionFacts } from '../types'

function cancellationFacts(
  status: CancellationStatus,
  overrides: Partial<SubscriptionFacts> = {},
) {
  return {
    cancellation_status: status,
    cancellation_path: null,
    cancellation_steps: [],
    cancellation_deadline: null,
    planned_cancel_date: null,
    cancellation_completed_at: null,
    reminder_settings: {
      enabled: true,
      offset_days: 7,
      state: 'enabled' as const,
    },
    ...overrides,
  }
}

describe('Subscription Detail presentation semantics', () => {
  it('maps every renewal state to contextual status and next-charge copy', () => {
    const cases: Array<{
      status: RenewalStatus
      date: string | null
      chip: string
      field: string
      nextCharge: string
    }> = [
      {
        status: 'auto_renew_on',
        date: '2026-08-13',
        chip: '自动续费',
        field: '自动续费',
        nextCharge: '2026年8月13日',
      },
      {
        status: 'auto_renew_on',
        date: null,
        chip: '自动续费',
        field: '自动续费',
        nextCharge: '日期未记录',
      },
      {
        status: 'auto_renew_off',
        date: '2026-08-13',
        chip: '已关闭自动续费',
        field: '已关闭自动续费',
        nextCharge: '不会自动扣费',
      },
      {
        status: 'manual_renewal',
        date: '2026-08-13',
        chip: '手动续费',
        field: '手动续费',
        nextCharge: '不会自动扣费',
      },
      {
        status: 'not_applicable',
        date: null,
        chip: '无需续费',
        field: '无需续费',
        nextCharge: '不适用',
      },
      {
        status: 'unknown',
        date: null,
        chip: '续费未确认',
        field: '未确认',
        nextCharge: '续费状态未确认',
      },
    ]

    cases.forEach(({ status, date, chip, field, nextCharge }) => {
      expect(getDetailRenewalPresentation(status, date)).toEqual({ chip, field, nextCharge })
    })
  })

  it('labels identity metadata and missing recorded dates by field meaning', () => {
    expect(formatDetailIdentity(null, null)).toBe('分类：未分类 · 订阅渠道：未记录')
    expect(formatDetailIdentity('生产力', 'Notion 官网')).toBe(
      '分类：生产力 · 订阅渠道：Notion 官网',
    )
    expect(formatRecordedDate(null)).toBe('未记录')
    expect(formatRecordedDate('2026-08-11')).toBe('2026年8月11日')
  })

  it('builds only the cancellation plan rows that apply to the current state', () => {
    expect(
      getCancellationDetailRows(
        cancellationFacts('none', {
          cancellation_path: 'Notion / Settings / Billing',
          cancellation_steps: ['Open billing'],
        }),
      ),
    ).toEqual([
      { label: '状态', value: '没有取消计划' },
    ])

    expect(getCancellationDetailRows(cancellationFacts('planned'))).toEqual([
      { label: '状态', value: '待取消' },
      { label: '计划取消日期', value: '未设置' },
      { label: '提醒时间', value: '提前 7 天' },
    ])

    expect(
      getCancellationDetailRows(
        cancellationFacts('in_progress', {
          cancellation_deadline: '2026-08-20',
          planned_cancel_date: '2026-08-18',
          reminder_settings: {
            enabled: true,
            offset_days: 2,
            state: 'enabled' as const,
          },
        }),
      ),
    ).toEqual([
      { label: '状态', value: '待取消' },
      { label: '计划取消日期', value: '2026年8月18日' },
      { label: '提醒时间', value: '提前 2 天' },
    ])

    expect(
      getCancellationDetailRows(
        cancellationFacts('confirmed', {
          cancellation_deadline: '2026-08-20',
          planned_cancel_date: '2026-08-18',
          cancellation_completed_at: '2026-08-17',
        }),
      ),
    ).toEqual([
      { label: '状态', value: '已完成取消' },
      { label: '原计划取消日期', value: '2026年8月18日' },
      { label: '完成时间', value: '2026年8月17日' },
    ])

    expect(
      getCancellationDetailRows(cancellationFacts('confirmed')).at(-1),
    ).toEqual({ label: '完成时间', value: '未记录' })
  })
})
