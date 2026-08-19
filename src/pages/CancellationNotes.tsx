import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import BoundaryNotice from '../components/BoundaryNotice'
import PageBackButton from '../components/PageBackButton'
import {
  CANCELLATION_REMINDER_LEADS,
  buildCancellationConfirmation,
  buildCancellationPlan,
  getCancellationReminderDate,
  getDefaultPlannedCancelDate,
  type CancellationReminderLead,
} from '../cancellation/cancellationManagement'
import { useSubscriptions } from '../store/useSubscriptions'
import type { SubscriptionRecord } from '../types'
import { formatDate } from '../utils/date'

const DEFAULT_REMINDER_LEAD: CancellationReminderLead = 1

export default function CancellationNotes() {
  const { id } = useParams<{ id: string }>()
  const { records, storageError, updateSubscriptionRecord } = useSubscriptions()

  const record = records.find((item) => item.facts.id === id)
  const detailFallback = id ? `/subscription/${id}` : '/subscriptions'

  const [plannedDate, setPlannedDate] = useState(getInitialPlannedDate(record))
  const [reminderLead, setReminderLead] = useState<CancellationReminderLead>(
    getInitialReminderLead(record),
  )
  const [isEditingPlan, setIsEditingPlan] = useState(
    record ? record.facts.cancellation_status === 'none' : true,
  )
  const [error, setError] = useState('')
  const [statusDone, setStatusDone] = useState('')
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!showCompleteConfirm) return undefined

    confirmButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowCompleteConfirm(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showCompleteConfirm])

  if (!record) {
    return (
      <div className="secondary-page space-y-4 py-12 text-center">
        <p className="text-sm text-gray-500">找不到这条记录</p>
        <PageBackButton fallback={detailFallback} label="返回记录详情" />
      </div>
    )
  }

  const currentRecord = record
  const facts = currentRecord.facts
  const hasActivePlan =
    facts.cancellation_status === 'planned' || facts.cancellation_status === 'in_progress'
  const isConfirmed = facts.cancellation_status === 'confirmed'

  function handleSavePlan() {
    setError('')
    const result = buildCancellationPlan(currentRecord, {
      plannedDate,
      reminderLeadDays: reminderLead,
      updatedAt: new Date().toISOString(),
    })

    if (!result.ok) {
      setError(
        result.error === 'invalid_reminder_lead'
          ? '请选择有效的提前提醒时间。'
          : '请选择有效的计划取消日期。',
      )
      return
    }

    const didSave = updateSubscriptionRecord(facts.id, () => result.record)
    if (!didSave) {
      setError(storageError ?? '取消计划无法保存，请重试。')
      return
    }

    setIsEditingPlan(false)
    flashStatus(hasActivePlan ? '取消计划已更新。' : '取消计划已创建。')
  }

  function handleConfirmCompleted() {
    setError('')
    const result = buildCancellationConfirmation(currentRecord, {
      updatedAt: new Date().toISOString(),
    })

    if (!result.ok) {
      setError('取消计划无法确认，请重试。')
      return
    }

    const didSave = updateSubscriptionRecord(facts.id, () => result.record)
    if (!didSave) {
      setError(storageError ?? '取消计划无法确认，请重试。')
      return
    }

    setShowCompleteConfirm(false)
    flashStatus('已标记为取消完成。')
  }

  function flashStatus(message: string) {
    setStatusDone(message)
    window.setTimeout(() => setStatusDone(''), 3000)
  }

  return (
    <div className="secondary-page space-y-4">
      <PageBackButton fallback={`/subscription/${facts.id}`} label={`返回 ${facts.service_name}`} />

      <div>
        <h2 className="text-lg font-semibold text-gray-900">计划取消</h2>
        <p className="mt-0.5 text-xs text-gray-500">{facts.service_name}</p>
      </div>

      <BoundaryNotice text="SubClear 不会自动取消订阅。" />
      <p className="-mt-3 text-xs text-gray-400">
        如果你决定不再续费，可以创建一个取消计划。SubClear 会在计划处理前提醒你，
        但不会替你自动取消订阅。
      </p>

      {statusDone && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          {statusDone}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <ReadonlyFactsCard
        nextChargeDate={facts.next_charge_date}
        price={facts.renewal_price}
        currency={facts.currency}
        billingCycle={facts.billing_cycle}
        platform={facts.platform}
      />

      {isConfirmed ? (
        <div className="rounded-lg border border-gray-100 px-3 py-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">取消计划</h3>
          <div className="space-y-2 text-xs text-gray-500">
            <PlanFactRow label="状态" value="已完成取消" />
            <PlanFactRow
              label="完成时间"
              value={facts.cancellation_completed_at ? formatDate(facts.cancellation_completed_at) : '未记录'}
            />
            {facts.planned_cancel_date && (
              <PlanFactRow label="原计划取消日期" value={formatDate(facts.planned_cancel_date)} />
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            这表示你已经在原平台完成取消操作，不代表会员权益已经结束。
          </p>
        </div>
      ) : (
        <>
          {hasActivePlan && !isEditingPlan ? (
            <div className="rounded-lg border border-gray-100 px-3 py-3">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">取消计划</h3>
              <div className="space-y-2 text-xs text-gray-500">
                <PlanFactRow label="状态" value="待取消" />
                <PlanFactRow
                  label="计划取消日期"
                  value={facts.planned_cancel_date ? formatDate(facts.planned_cancel_date) : '未设置'}
                />
                <PlanFactRow label="提醒" value={formatReminderLead(facts.reminder_settings.offset_days)} />
                <PlanFactRow
                  label="提醒日期"
                  value={
                    getCancellationReminderDate(
                      facts.planned_cancel_date,
                      getInitialReminderLead(currentRecord),
                    )
                      ? formatDate(
                          getCancellationReminderDate(
                            facts.planned_cancel_date,
                            getInitialReminderLead(currentRecord),
                          )!,
                        )
                      : '未设置'
                  }
                />
              </div>
            </div>
          ) : (
            <PlanForm
              plannedDate={plannedDate}
              reminderLead={reminderLead}
              submitLabel={hasActivePlan ? '保存修改' : '创建取消计划'}
              onPlannedDateChange={setPlannedDate}
              onReminderLeadChange={setReminderLead}
              onSubmit={handleSavePlan}
            />
          )}

          {hasActivePlan && !isEditingPlan && (
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(true)}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white active:bg-blue-700"
              >
                标记已取消
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPlan(true)}
                className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 active:bg-gray-50"
              >
                修改计划
              </button>
            </div>
          )}
        </>
      )}

      {showCompleteConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/20 px-4 py-6"
          style={{ margin: 0 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="确认已经在原平台完成取消？"
            className="relative z-[110] max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-xl bg-white p-4 shadow-lg"
          >
            <h3 className="text-sm font-semibold text-gray-900">
              确认已经在原平台完成取消？
            </h3>
            <p className="mt-2 text-xs text-gray-500">
              SubClear 不会替你检查外部平台状态。请只在你已经完成取消操作后确认。
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
              >
                取消
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={handleConfirmCompleted}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white"
              >
                确认已取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlanForm({
  plannedDate,
  reminderLead,
  submitLabel,
  onPlannedDateChange,
  onReminderLeadChange,
  onSubmit,
}: {
  plannedDate: string
  reminderLead: CancellationReminderLead
  submitLabel: string
  onPlannedDateChange: (value: string) => void
  onReminderLeadChange: (value: CancellationReminderLead) => void
  onSubmit: () => void
}) {
  return (
    <div className="rounded-lg border border-gray-100 px-3 py-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">取消计划</h3>
      <div className="space-y-3">
        <div>
          <label htmlFor="planned-cancel-date" className="mb-1 block text-xs text-gray-500">
            计划取消日期
          </label>
          <input
            id="planned-cancel-date"
            type="date"
            value={plannedDate}
            onChange={(event) => onPlannedDateChange(event.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="cancellation-reminder-lead" className="mb-1 block text-xs text-gray-500">
            提前提醒
          </label>
          <select
            id="cancellation-reminder-lead"
            value={reminderLead}
            onChange={(event) => onReminderLeadChange(Number(event.target.value) as CancellationReminderLead)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          >
            {CANCELLATION_REMINDER_LEADS.map((lead) => (
              <option key={lead} value={lead}>
                {formatReminderLead(lead)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white active:bg-blue-700"
      >
        {submitLabel}
      </button>
    </div>
  )
}

function ReadonlyFactsCard({
  nextChargeDate,
  price,
  currency,
  billingCycle,
  platform,
}: {
  nextChargeDate: string | null
  price: number | null
  currency: string | null
  billingCycle: string | null
  platform: string | null
}) {
  return (
    <div className="rounded-lg border border-gray-100 px-3 py-3">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">当前记录</h3>
      <div className="space-y-2 text-xs text-gray-500">
        <PlanFactRow
          label="下次续费"
          value={nextChargeDate ? formatDate(nextChargeDate) : '未记录'}
        />
        <PlanFactRow label="续费金额" value={formatPrice(price, currency, billingCycle)} />
        <PlanFactRow label="订阅渠道" value={platform ?? '暂不确定'} />
      </div>
    </div>
  )
}

function PlanFactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-700">{value}</span>
    </div>
  )
}

function getInitialPlannedDate(record: SubscriptionRecord | undefined): string {
  if (!record) return ''
  return record.facts.planned_cancel_date ?? getDefaultPlannedCancelDate(record.facts.next_charge_date) ?? ''
}

function getInitialReminderLead(record: SubscriptionRecord | undefined): CancellationReminderLead {
  if (!record) return DEFAULT_REMINDER_LEAD
  const offset = record.facts.reminder_settings.offset_days
  return CANCELLATION_REMINDER_LEADS.includes(offset as CancellationReminderLead)
    ? (offset as CancellationReminderLead)
    : DEFAULT_REMINDER_LEAD
}

function formatReminderLead(value: number): string {
  return value === 0 ? '当天提醒' : `提前 ${value} 天`
}

function formatPrice(price: number | null, currency: string | null, billingCycle: string | null): string {
  if (price === null) return '未记录'
  const amount = `${currency ?? ''} ${price.toFixed(2)}`.trim()
  return billingCycle ? `${amount} / ${formatBillingCycle(billingCycle)}` : amount
}

function formatBillingCycle(value: string): string {
  const labels: Record<string, string> = {
    weekly: '每周',
    monthly: '每月',
    quarterly: '每季度',
    yearly: '每年',
    custom: '自定义',
    unknown: '未知',
  }
  return labels[value] ?? value.replaceAll('_', ' ')
}
