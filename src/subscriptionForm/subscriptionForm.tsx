import { useState, type FormEvent } from 'react'
import ReminderPreview from '../components/ReminderPreview'
import { MANUAL_PLATFORM_OPTIONS, MANUAL_RENEWAL_OPTIONS } from '../manual/manualSubscription'
import type { SubscriptionFactBillingCycle } from '../types'
import {
  BILLING_CYCLE_OPTIONS,
  SUBSCRIPTION_FORM_CURRENCIES,
  validateSubscriptionForm,
  type SubscriptionFormProps,
  type SubscriptionFormValues,
} from './subscriptionFormCore'

export default function SubscriptionForm({
  variant,
  initialValues,
  submitLabel,
  onValidSubmit,
  intro,
  hints = [],
  showPlanName = false,
  showRecordType = false,
  showMembershipEndDate = false,
}: SubscriptionFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<string[]>([])
  const effectiveType = variant === 'trial' ? 'trial' : values.recordType
  const priceHint = hints.find((hint) => hint.field === 'renewalPrice')

  function update(patch: Partial<SubscriptionFormValues>) {
    setValues((current) => {
      const next = { ...current, ...patch }
      if (patch.recordType === 'trial') {
        next.currency = ''
      }
      if (patch.recordType === 'paid_membership' && !next.currency) {
        next.currency = 'USD'
      }
      if (patch.renewalStatus && patch.renewalStatus !== 'auto_renew_on') {
        next.nextChargeDate = ''
      }
      if (patch.renewalStatus && patch.renewalStatus !== 'auto_renew_off') {
        next.cancellationPath = ''
      }
      if (patch.platformSelect && patch.platformSelect !== '__other__') {
        next.customPlatform = ''
      }
      return next
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const errs = validateSubscriptionForm(values, variant)
    if (errs.length > 0) {
      setErrors(errs)
      return
    }

    const submitErrors = onValidSubmit(values)
    setErrors(submitErrors ?? [])
  }

  return (
    <>
      {intro && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-800">
          {intro}
        </div>
      )}

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-0.5">
          {errors.map((error, index) => (
            <p key={`${error}-${index}`} className="text-xs text-red-700">{error}</p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset>
          <legend className="text-sm font-semibold text-gray-700 mb-2">基本信息</legend>
          <div className="space-y-3">
            {showRecordType && (
              <SelectField
                id="subscription-record-type"
                label="记录类型"
                value={values.recordType}
                onChange={(value) => update({ recordType: value as SubscriptionFormValues['recordType'] })}
                options={[
                  { value: 'paid_membership', label: '付费会员' },
                  { value: 'trial', label: '免费试用' },
                ]}
              />
            )}
            <TextField
              id="subscription-service-name"
              label="服务名称"
              value={values.serviceName}
              onChange={(value) => update({ serviceName: value })}
              placeholder={effectiveType === 'trial' ? '例如：Notion Pro' : '例如：Spotify Premium'}
            />
            {showPlanName && (
              <TextField
                id="subscription-plan-name"
                label="套餐名称"
                value={values.planName}
                onChange={(value) => update({ planName: value })}
                placeholder="例如：Premium Monthly"
              />
            )}
            <SelectField
              id="subscription-platform"
              label="订阅渠道"
              value={values.platformSelect}
              onChange={(value) => update({ platformSelect: value })}
              options={MANUAL_PLATFORM_OPTIONS}
            />
            {values.platformSelect === '__other__' && (
              <TextField
                id="subscription-custom-platform"
                label="其他订阅渠道"
                value={values.customPlatform}
                onChange={(value) => update({ customPlatform: value })}
                placeholder="例如：支付宝、运营商、第三方平台"
              />
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-gray-700 mb-2">续费与时间</legend>
          <div className="space-y-3">
            {effectiveType === 'trial' && (
              <DateField
                id="subscription-end-date"
                label="试用结束日期"
                value={values.membershipEndDate}
                onChange={(value) => update({ membershipEndDate: value })}
              />
            )}
            <DateField
              id="subscription-start-date"
              label={effectiveType === 'trial' ? '试用开始日期' : '开始日期'}
              value={values.membershipStartDate}
              onChange={(value) => update({ membershipStartDate: value })}
            />
            {effectiveType !== 'trial' && showMembershipEndDate && (
              <DateField
                id="subscription-end-date"
                label="会员到期"
                value={values.membershipEndDate}
                onChange={(value) => update({ membershipEndDate: value })}
              />
            )}
            <SelectField
              id="subscription-renewal-status"
              label="续费方式"
              value={values.renewalStatus}
              onChange={(value) => update({ renewalStatus: value as SubscriptionFormValues['renewalStatus'] })}
              options={MANUAL_RENEWAL_OPTIONS}
            />
            {values.renewalStatus === 'auto_renew_on' && (
              <DateField
                id="subscription-next-charge-date"
                label="下次自动扣费日期"
                value={values.nextChargeDate}
                onChange={(value) => update({ nextChargeDate: value })}
              />
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-gray-700 mb-2">
            {effectiveType === 'trial' ? '试用后费用' : '费用'}
          </legend>
          <div className="space-y-3">
            <div className={effectiveType === 'paid_membership' ? 'flex gap-2' : 'space-y-3'}>
              <div className="flex-1">
                <NumberField
                  id="subscription-price"
                  label={effectiveType === 'trial' ? '试用后价格' : variant === 'ai' ? '续费金额' : '价格'}
                  value={values.renewalPrice}
                  onChange={(value) => update({ renewalPrice: value })}
                  placeholder={effectiveType === 'trial' ? '例如：10.00' : '10.99'}
                />
                {priceHint && (
                  <div className="mt-1 space-y-1 text-xs text-amber-700">
                    <p>{priceHint.message}</p>
                    {priceHint.action && (
                      <button
                        type="button"
                        className="font-medium underline"
                        onClick={() => update(priceHint.action?.apply ?? {})}
                      >
                        {priceHint.action.label}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {effectiveType === 'paid_membership' && (
                <div className="w-24">
                  <SelectField
                    id="subscription-currency"
                    label="币种"
                    value={values.currency}
                    onChange={(value) => update({ currency: value })}
                    options={SUBSCRIPTION_FORM_CURRENCIES.map((currency) => ({
                      value: currency,
                      label: currency,
                    }))}
                  />
                </div>
              )}
            </div>
            <SelectField
              id="subscription-billing-cycle"
              label={effectiveType === 'trial' ? '计费周期（试用后）' : '计费周期'}
              value={values.billingCycle}
              onChange={(value) => update({ billingCycle: value as SubscriptionFactBillingCycle | '' })}
              options={BILLING_CYCLE_OPTIONS}
            />
          </div>
        </fieldset>

        {values.renewalStatus === 'auto_renew_off' && (
          <fieldset>
            <legend className="text-sm font-semibold text-gray-700 mb-2">取消方式 / 备注</legend>
            <TextField
              id="subscription-cancellation-path"
              label="取消链接或备注"
              value={values.cancellationPath}
              onChange={(value) => update({ cancellationPath: value })}
              placeholder="例如：https://..."
            />
          </fieldset>
        )}

        <fieldset>
          <legend className="text-sm font-semibold text-gray-700 mb-2">备注</legend>
          <textarea
            id="subscription-notes"
            aria-label="备注"
            value={values.notes}
            onChange={(event) => update({ notes: event.target.value })}
            placeholder="任何值得记住的信息..."
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
          />
        </fieldset>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">提醒预览</h3>
          <ReminderPreview
            offsetDays={effectiveType === 'trial' ? 3 : 7}
            keyDate={
              effectiveType === 'trial'
                ? values.membershipEndDate || undefined
                : values.nextChargeDate || undefined
            }
            state="enabled"
            eventLabel={effectiveType === 'trial' ? '试用结束' : '续费'}
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white text-sm font-medium py-2.5 rounded-lg active:bg-blue-700"
        >
          {submitLabel}
        </button>
      </form>
    </>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
      />
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        id={id}
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
      />
    </div>
  )
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
      />
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )
}
