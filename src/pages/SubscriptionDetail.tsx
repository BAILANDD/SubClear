import { Link, useNavigate, useParams } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import BoundaryNotice from '../components/BoundaryNotice'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import PageBackButton from '../components/PageBackButton'
import MembershipBadge from '../components/MembershipBadge'
import ReminderBadge from '../components/ReminderBadge'
import RenewalBadge from '../components/RenewalBadge'
import {
  getMembershipStatus,
  getReferenceDate,
} from '../presentation/subscriptionPresentation'
import {
  formatDetailIdentity,
  formatDetailRemainingTime,
  formatRecordedDate,
  getCancellationDetailRows,
  getDetailRenewalPresentation,
} from '../presentation/subscriptionDetailPresentation'
import { getReminderTrigger } from '../reminder/reminderManagement'
import { useSubscriptions } from '../store/useSubscriptions'
import type { SubscriptionRecord } from '../types'
import { formatDate } from '../utils/date'

export default function SubscriptionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { records, storageError, deleteSubscriptionRecord } = useSubscriptions()
  const record = records.find((item) => item.facts.id === id)
  const referenceDate = getReferenceDate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!record) {
    return (
      <div className="secondary-page space-y-4 py-12 text-center">
        <p className="text-sm text-gray-500">找不到这条记录</p>
        <PageBackButton fallback="/subscriptions" label="返回记录列表" />
      </div>
    )
  }

  const facts = record.facts
  const membershipStatus = getMembershipStatus(record, referenceDate)
  const renewalPresentation = getDetailRenewalPresentation(
    facts.renewal_status,
    facts.next_charge_date,
  )
  const cancellationRows = getCancellationDetailRows(facts)

  return (
    <div className="secondary-page space-y-4">
      <PageBackButton fallback="/subscriptions" label="返回记录列表" />

      {storageError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {storageError} 这条记录将以安全只读模式显示。
        </div>
      )}

      <header className="space-y-2">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{facts.service_name}</h2>
            <Link
              to={`/subscription/${facts.id}/edit`}
              className="shrink-0 text-xs text-blue-600 underline"
            >
              编辑记录
            </Link>
          </div>
          {facts.plan_name && <p className="text-sm text-gray-500">{facts.plan_name}</p>}
          <p className="text-xs text-gray-400">
            {formatDetailIdentity(facts.category, facts.platform)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <MembershipBadge status={membershipStatus} />
          <RenewalBadge status={facts.renewal_status} label={renewalPresentation.chip} />
        </div>
      </header>

      <DetailModule title="会员权益">
        <div className="space-y-2 text-xs text-gray-500">
          <FactRow label="权益类型" value={formatToken(facts.entitlement_type)} />
          <FactRow label="会员状态" value={membershipStatus === 'unknown' ? '未知' : undefined}>
            {membershipStatus !== 'unknown' && <MembershipBadge status={membershipStatus} />}
          </FactRow>
          <FactRow label="开始日期" value={formatRecordedDate(facts.membership_start_date)} />
          <FactRow label="结束日期" value={formatRecordedDate(facts.membership_end_date)} />
          <FactRow label="剩余时间" value={formatDetailRemainingTime(record, referenceDate)} />
        </div>
      </DetailModule>

      <DetailModule title="续费信息">
        <div className="space-y-2 text-xs text-gray-500">
          <FactRow label="续费状态">
            <RenewalBadge status={facts.renewal_status} label={renewalPresentation.field} />
          </FactRow>
          <FactRow label="下次自动扣费" value={renewalPresentation.nextCharge} />
          <FactRow label="价格" value={formatPrice(facts.renewal_price, facts.currency, facts.billing_cycle)} />
        </div>
      </DetailModule>

      <DetailModule
        title="提醒"
        action={
          <Link to={`/subscription/${facts.id}/reminder`} className="text-xs text-blue-600 underline">
            管理提醒
          </Link>
        }
      >
        <div className="space-y-2 text-xs text-gray-500">
          <ReminderBadge state={facts.reminder_settings.state ?? 'enabled'} />
          <p>{getReminderSummary(record)}</p>
          <p className="text-gray-400">当前 demo 中的提醒为模拟状态。</p>
        </div>
      </DetailModule>

      <DetailModule
        title="取消计划"
        action={
          <Link to={`/subscription/${facts.id}/cancellation`} className="text-xs text-blue-600 underline">
            {getCancellationActionLabel(facts.cancellation_status)}
          </Link>
        }
      >
        <BoundaryNotice text="SubClear 不会自动取消订阅。" />
        <div className="mt-2 space-y-2 text-xs text-gray-500">
          {cancellationRows.map((row) => (
            <FactRow key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      </DetailModule>

      <div className="border-t border-gray-100 pt-3 text-xs text-gray-400">
        创建于 {formatDate(facts.created_at.split('T')[0])}
        {facts.updated_at !== facts.created_at &&
          ` · 更新于 ${formatDate(facts.updated_at.split('T')[0])}`}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-xs text-gray-400 underline"
        >
          删除记录
        </button>
      </div>

      {showDeleteConfirm && id && (
        <DeleteConfirmModal
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            const ok = deleteSubscriptionRecord(id)
            if (ok) {
              navigate('/subscriptions', { replace: true })
            }
          }}
        />
      )}
    </div>
  )
}

function DetailModule({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-lg border border-gray-100 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function FactRow({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-700">{children ?? value}</span>
    </div>
  )
}

function formatPrice(price: number | null, currency: string | null, billingCycle: string | null): string {
  if (price === null) return '未知'
  const amount = `${currency ?? ''} ${price.toFixed(2)}`.trim()
  return billingCycle ? `${amount} / ${formatToken(billingCycle)}` : amount
}

function formatToken(value: string): string {
  const labels: Record<string, string> = {
    trial: '试用',
    paid_membership: '付费会员',
    one_time_purchase: '一次性购买',
    lifetime: '终身',
    unknown: '未知',
    weekly: '每周',
    monthly: '每月',
    quarterly: '每季度',
    yearly: '每年',
    custom: '自定义',
    'planned cancellation': '计划取消',
    'next charge': '下次扣费',
    'membership end': '会员到期',
  }
  return labels[value] ?? value.replaceAll('_', ' ')
}

function getCancellationActionLabel(status: string): string {
  if (status === 'none') return '计划取消'
  if (status === 'confirmed') return '查看取消计划'
  return '管理取消计划'
}

function getReminderSummary(record: SubscriptionRecord): string {
  const settings = record.facts.reminder_settings
  if (!settings.enabled || settings.state === 'disabled') return '模拟提醒已关闭。'
  if (settings.state === 'blocked') return '模拟提醒暂不可用。'

  const trigger = getReminderTrigger(record)
  if (trigger.status === 'unavailable') return '没有可用于模拟提醒的日期。'

  return `模拟提醒已开启：在${formatToken(trigger.label)}前 ${settings.offset_days} 天提醒，日期为 ${formatDate(trigger.date)}。`
}
