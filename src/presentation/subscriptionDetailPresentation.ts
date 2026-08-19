import type { ReminderSettings, RenewalStatus, SubscriptionFacts, SubscriptionRecord } from '../types'
import { formatDate } from '../utils/date'
import { formatRemainingDays } from './subscriptionPresentation'

export interface DetailRenewalPresentation {
  chip: string
  field: string
  nextCharge: string
}

export interface DetailFactRow {
  label: string
  value: string
}

type CancellationDetailFacts = Pick<
  SubscriptionFacts,
  | 'cancellation_status'
  | 'planned_cancel_date'
  | 'cancellation_completed_at'
  | 'reminder_settings'
>

export function formatDetailIdentity(category: string | null, channel: string | null): string {
  return `分类：${category ?? '未分类'} · 订阅渠道：${channel ?? '未记录'}`
}

export function formatRecordedDate(value: string | null): string {
  return value ? formatDate(value) : '未记录'
}

export function formatDetailRemainingTime(
  record: SubscriptionRecord,
  referenceDate: string,
): string {
  const remaining = formatRemainingDays(record, referenceDate)
  return remaining === '未知' ? '无法计算' : remaining
}

export function getCancellationDetailRows(facts: CancellationDetailFacts): DetailFactRow[] {
  const statusLabels = {
    none: '没有取消计划',
    planned: '待取消',
    in_progress: '待取消',
    confirmed: '已完成取消',
  } as const
  const rows: DetailFactRow[] = [
    { label: '状态', value: statusLabels[facts.cancellation_status] },
  ]

  if (facts.cancellation_status === 'planned' || facts.cancellation_status === 'in_progress') {
    rows.push(
      {
        label: '计划取消日期',
        value: facts.planned_cancel_date ? formatDate(facts.planned_cancel_date) : '未设置',
      },
      { label: '提醒时间', value: formatReminderLead(facts.reminder_settings) },
    )
  }

  if (facts.cancellation_status === 'confirmed') {
    if (facts.planned_cancel_date) {
      rows.push({ label: '原计划取消日期', value: formatDate(facts.planned_cancel_date) })
    }
    rows.push({ label: '完成时间', value: formatRecordedDate(facts.cancellation_completed_at) })
  }

  return rows
}

function formatReminderLead(settings: ReminderSettings): string {
  return settings.offset_days === 0 ? '当天提醒' : `提前 ${settings.offset_days} 天`
}

export function getDetailRenewalPresentation(
  status: RenewalStatus,
  nextChargeDate: string | null,
): DetailRenewalPresentation {
  switch (status) {
    case 'auto_renew_on':
      return {
        chip: '自动续费',
        field: '自动续费',
        nextCharge: nextChargeDate ? formatDate(nextChargeDate) : '日期未记录',
      }
    case 'auto_renew_off':
      return {
        chip: '已关闭自动续费',
        field: '已关闭自动续费',
        nextCharge: '不会自动扣费',
      }
    case 'manual_renewal':
      return {
        chip: '手动续费',
        field: '手动续费',
        nextCharge: '不会自动扣费',
      }
    case 'not_applicable':
      return {
        chip: '无需续费',
        field: '无需续费',
        nextCharge: '不适用',
      }
    case 'unknown':
      return {
        chip: '续费未确认',
        field: '未确认',
        nextCharge: '续费状态未确认',
      }
  }
}
