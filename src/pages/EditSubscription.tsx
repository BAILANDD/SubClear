import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSubscriptions } from '../store/useSubscriptions'
import { formatDate } from '../utils/date'
import ReminderPreview from '../components/ReminderPreview'
import BoundaryNotice from '../components/BoundaryNotice'
import PageBackButton from '../components/PageBackButton'
import {
  isValidDateOnly,
  MANUAL_PLATFORM_OPTIONS,
  MANUAL_RENEWAL_OPTIONS,
} from '../manual/manualSubscription'
import type { BillingCycle, RenewalStatus, SubscriptionFactBillingCycle } from '../types'

const currencies = ['USD', 'EUR', 'GBP', 'CNY', 'JPY', 'CAD', 'AUD']

function mapPlatformToForm(platform: string | null): {
  platformSelect: string
  customPlatform: string
} {
  if (!platform) return { platformSelect: '', customPlatform: '' }
  if (
    platform === '官方网站' ||
    platform === 'App Store' ||
    platform === 'Google Play'
  ) {
    return { platformSelect: platform, customPlatform: '' }
  }
  return { platformSelect: '__other__', customPlatform: platform }
}

export default function EditSubscription() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { records, updateSubscriptionRecord } = useSubscriptions()
  const record = records.find((item) => item.facts.id === id)

  if (!record) {
    return (
      <div className="secondary-page space-y-4 py-12 text-center">
        <p className="text-sm text-gray-500">找不到这条记录</p>
        <PageBackButton fallback="/subscriptions" label="返回记录列表" />
      </div>
    )
  }

  const facts = record.facts
  const isTrial = facts.entitlement_type === 'trial'

  return (
    <EditSubscriptionForm
      id={id!}
      facts={facts}
      isTrial={isTrial}
      updateSubscriptionRecord={updateSubscriptionRecord}
      navigate={navigate}
    />
  )
}

function EditSubscriptionForm({
  id,
  facts,
  isTrial,
  updateSubscriptionRecord,
  navigate,
}: {
  id: string
  facts: ReturnType<typeof useSubscriptions>['records'][number]['facts']
  isTrial: boolean
  updateSubscriptionRecord: ReturnType<typeof useSubscriptions>['updateSubscriptionRecord']
  navigate: ReturnType<typeof useNavigate>
}) {
  const platformInit = useMemo(() => mapPlatformToForm(facts.platform), [facts.platform])

  const [serviceName, setServiceName] = useState(facts.service_name)
  const [startDate, setStartDate] = useState(facts.membership_start_date ?? '')
  const [endDate, setEndDate] = useState(facts.membership_end_date ?? '')
  const [renewalStatus, setRenewalStatus] = useState<RenewalStatus>(facts.renewal_status)
  const [nextChargeDate, setNextChargeDate] = useState(facts.next_charge_date ?? '')
  const [price, setPrice] = useState(
    facts.renewal_price !== null ? String(facts.renewal_price) : '',
  )
  const [currency, setCurrency] = useState(facts.currency ?? 'USD')
  const [billingCycle, setBillingCycle] = useState<BillingCycle | ''>(
    (facts.billing_cycle as BillingCycle | '') ?? '',
  )
  const [cancelUrl, setCancelUrl] = useState(facts.cancellation_path ?? '')
  const [notes, setNotes] = useState('')
  const [platformSelect, setPlatformSelect] = useState(platformInit.platformSelect)
  const [customPlatform, setCustomPlatform] = useState(platformInit.customPlatform)
  const [errors, setErrors] = useState<string[]>([])

  function handleRenewalStatusChange(value: RenewalStatus) {
    setRenewalStatus(value)
    if (value !== 'auto_renew_on') {
      setNextChargeDate('')
    }
  }

  function validate(): string[] {
    const errs: string[] = []
    if (!serviceName.trim()) errs.push('服务名称为必填项。')

    if (isTrial) {
      if (!endDate) {
        errs.push('试用结束日期为必填项。')
      } else if (!isValidDateOnly(endDate)) {
        errs.push('请输入有效的试用结束日期。')
      }
      if (startDate) {
        if (!isValidDateOnly(startDate)) {
          errs.push('请输入有效的试用开始日期。')
        } else if (
          endDate &&
          isValidDateOnly(endDate) &&
          startDate > endDate
        ) {
          errs.push('开始日期不能晚于试用结束日期')
        }
      }
    } else {
      if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
        errs.push('请输入有效价格。')
      }
      if (!currency) errs.push('币种为必填项。')
      if (!billingCycle) errs.push('计费周期为必填项。')
      if (startDate && !isValidDateOnly(startDate)) {
        errs.push('请输入有效的开始日期。')
      }
    }

    if (nextChargeDate && !isValidDateOnly(nextChargeDate)) {
      errs.push('请输入有效的下次自动扣费日期。')
    }
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (errs.length > 0) return

    let platform: string | null = null
    if (platformSelect === '__other__') {
      platform = customPlatform.trim() || null
    } else if (platformSelect) {
      platform = platformSelect
    }

    const now = new Date().toISOString()

    const ok = updateSubscriptionRecord(id, (current) => ({
      ...current,
      facts: {
        ...current.facts,
        service_name: serviceName.trim(),
        platform,
        membership_start_date: startDate || null,
        membership_end_date: isTrial ? endDate : current.facts.membership_end_date,
        renewal_status: renewalStatus,
        next_charge_date:
          renewalStatus === 'auto_renew_on' ? (nextChargeDate || null) : null,
        renewal_price: isTrial
          ? (price ? parseFloat(price) : null)
          : parseFloat(price),
        currency: isTrial ? null : currency,
        billing_cycle: isTrial
          ? ((billingCycle || null) as SubscriptionFactBillingCycle | null)
          : (billingCycle as SubscriptionFactBillingCycle),
        cancellation_path: cancelUrl.trim() || null,
        updated_at: now,
      },
    }))

    if (!ok) {
      setErrors(['无法保存记录，请重试。'])
      return
    }

    navigate(`/subscription/${id}`, { replace: true })
  }

  return (
    <div className="secondary-page space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">编辑会员记录</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            更新这条会员记录的信息。
          </p>
        </div>
        <PageBackButton fallback={`/subscription/${id}`} label="返回" />
      </div>

      <BoundaryNotice text="无需连接银行。请手动输入信息。" />

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-0.5">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-red-700">{e}</p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Required Fields */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-700 mb-2">必填</legend>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">服务名称</label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder={isTrial ? '例如：Notion Pro' : '例如：Spotify Premium'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            {isTrial ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">试用结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
                {endDate && (
                  <p className="text-xs text-gray-400 mt-1">
                    结束于 {formatDate(endDate)}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">价格</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="10.99"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">币种</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
                    >
                      {currencies.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">计费周期</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle | '')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
                  >
                    <option value="">请选择...</option>
                    <option value="monthly">每月</option>
                    <option value="yearly">每年</option>
                    <option value="weekly">每周</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </fieldset>

        {/* Optional Fields */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-700 mb-2">选填</legend>
          <div className="space-y-3">
            <div>
              <label htmlFor="edit-platform" className="block text-xs text-gray-500 mb-1">
                订阅渠道
              </label>
              <select
                id="edit-platform"
                value={platformSelect}
                onChange={(e) => {
                  const value = e.target.value
                  setPlatformSelect(value)
                  if (value !== '__other__') {
                    setCustomPlatform('')
                  }
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
              >
                {MANUAL_PLATFORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {platformSelect === '__other__' && (
                <input
                  type="text"
                  value={customPlatform}
                  onChange={(e) => setCustomPlatform(e.target.value)}
                  placeholder="例如：支付宝、运营商、第三方平台"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mt-2"
                />
              )}
            </div>
            <div>
              <label htmlFor="edit-start-date" className="block text-xs text-gray-500 mb-1">
                {isTrial ? '试用开始日期' : '开始日期'}
              </label>
              <input
                id="edit-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label htmlFor="edit-renewal-status" className="block text-xs text-gray-500 mb-1">
                续费方式
              </label>
              <select
                id="edit-renewal-status"
                value={renewalStatus}
                onChange={(e) => handleRenewalStatusChange(e.target.value as RenewalStatus)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
              >
                {MANUAL_RENEWAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            {renewalStatus === 'auto_renew_on' && (
              <div>
                <label htmlFor="edit-next-charge-date" className="block text-xs text-gray-500 mb-1">
                  下次自动扣费日期
                </label>
                <input
                  id="edit-next-charge-date"
                  type="date"
                  value={nextChargeDate}
                  onChange={(e) => setNextChargeDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            )}
            {isTrial && (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">试用后价格</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="例如：10.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">计费周期（试用后）</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle | '')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
                  >
                    <option value="">请选择...</option>
                    <option value="monthly">每月</option>
                    <option value="yearly">每年</option>
                    <option value="weekly">每周</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">取消链接或备注</label>
              <input
                type="text"
                value={cancelUrl}
                onChange={(e) => setCancelUrl(e.target.value)}
                placeholder="例如：https://..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">备注</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="任何值得记住的信息..."
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Reminder Preview */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">提醒预览</h3>
          <ReminderPreview
            offsetDays={isTrial ? 3 : 7}
            keyDate={isTrial ? (endDate || undefined) : (nextChargeDate || undefined)}
            state="enabled"
            eventLabel={isTrial ? '试用结束' : '续费'}
          />
        </div>

        {/* Save */}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg active:bg-blue-700"
        >
          保存修改
        </button>
      </form>
    </div>
  )
}
