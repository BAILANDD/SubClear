import {
  buildManualSubscriptionRecord,
  isValidDateOnly,
  MANUAL_PLATFORM_OPTIONS,
} from '../manual/manualSubscription'
import type { CaptureSessionDraft } from '../types/capture'
import type {
  EvidenceRecord,
  ExtractedFieldValue,
  FieldEvidence,
  SubscriptionFactFieldName,
} from '../types/evidence'
import type {
  EntitlementType,
  RenewalStatus,
  SubscriptionFactBillingCycle,
  SubscriptionRecord,
} from '../types'
import { reconcileAiEvidenceWithSavedForm } from './evidenceReconciliation'

export type SubscriptionFormVariant = 'trial' | 'paid' | 'ai'

export interface SubscriptionFormValues {
  recordType: Extract<EntitlementType, 'trial' | 'paid_membership'>
  serviceName: string
  planName: string
  platformSelect: string
  customPlatform: string
  membershipStartDate: string
  membershipEndDate: string
  renewalStatus: RenewalStatus
  nextChargeDate: string
  renewalPrice: string
  currency: string
  billingCycle: SubscriptionFactBillingCycle | ''
  cancellationPath: string
  notes: string
}

export interface SubscriptionFormHint {
  field: 'renewalPrice' | 'currency' | 'billingCycle' | 'membershipEndDate' | 'nextChargeDate'
  message: string
  action?: {
    label: string
    apply: Partial<SubscriptionFormValues>
  }
}

export interface SubscriptionFormProps {
  variant: SubscriptionFormVariant
  initialValues: SubscriptionFormValues
  submitLabel: string
  onValidSubmit: (values: SubscriptionFormValues) => string[] | void
  intro?: string
  hints?: SubscriptionFormHint[]
  showPlanName?: boolean
  showRecordType?: boolean
  showMembershipEndDate?: boolean
}

export interface BuildSubscriptionRecordFromFormOptions {
  id: string
  timestamp: string
  evidenceRecords?: EvidenceRecord[]
}

export const SUBSCRIPTION_FORM_CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY', 'JPY', 'CAD', 'AUD']

export const BILLING_CYCLE_OPTIONS: ReadonlyArray<{
  value: SubscriptionFactBillingCycle | ''
  label: string
}> = [
  { value: '', label: '请选择...' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
  { value: 'weekly', label: '每周' },
  { value: 'quarterly', label: '每季度' },
  { value: 'custom', label: '自定义' },
]

export function createEmptySubscriptionFormValues(
  recordType: Extract<EntitlementType, 'trial' | 'paid_membership'>,
): SubscriptionFormValues {
  return {
    recordType,
    serviceName: '',
    planName: '',
    platformSelect: '',
    customPlatform: '',
    membershipStartDate: '',
    membershipEndDate: '',
    renewalStatus: 'unknown',
    nextChargeDate: '',
    renewalPrice: '',
    currency: recordType === 'paid_membership' ? 'USD' : '',
    billingCycle: '',
    cancellationPath: '',
    notes: '',
  }
}

export function mapAiCaptureDraftToSubscriptionFormValues(draft: CaptureSessionDraft): {
  values: SubscriptionFormValues
  hints: SubscriptionFormHint[]
} {
  const fieldMap = mapFieldsByName(draft.review_fields)
  const facts = draft.draft_record
  const priceInfo = getPricePrefill(fieldMap.renewal_price)
  const currency =
    getStringValue(fieldMap.currency?.extracted_value) ??
    priceInfo.currency ??
    facts?.currency ??
    'CNY'
  const platform = getStringValue(fieldMap.platform?.extracted_value) ?? facts?.platform ?? ''
  const platformValue = mapPlatformToFormValues(platform)
  const billingCycle = toBillingCycle(
    getStringValue(fieldMap.billing_cycle?.extracted_value) ?? facts?.billing_cycle ?? null,
  )
  const recordType = toRecordType(
    getStringValue(fieldMap.entitlement_type?.extracted_value) ?? facts?.entitlement_type ?? null,
  )
  const renewalPrice =
    priceInfo.value ||
    (facts?.renewal_price !== null && facts?.renewal_price !== undefined
      ? String(facts.renewal_price)
      : '')
  const hints: SubscriptionFormHint[] = []

  if (priceInfo.hint) {
    hints.push(priceInfo.hint)
  }

  return {
    values: {
      ...createEmptySubscriptionFormValues(recordType),
      serviceName: getStringValue(fieldMap.service_name?.extracted_value) ?? facts?.service_name ?? '',
      planName: getStringValue(fieldMap.plan_name?.extracted_value) ?? facts?.plan_name ?? '',
      platformSelect: platformValue.platformSelect,
      customPlatform: platformValue.customPlatform,
      membershipStartDate:
        getStringValue(fieldMap.membership_start_date?.extracted_value) ??
        facts?.membership_start_date ??
        '',
      membershipEndDate:
        getStringValue(fieldMap.membership_end_date?.extracted_value) ??
        facts?.membership_end_date ??
        '',
      renewalStatus: toRenewalStatus(
        getStringValue(fieldMap.renewal_status?.extracted_value) ?? facts?.renewal_status ?? null,
      ),
      nextChargeDate:
        getStringValue(fieldMap.next_charge_date?.extracted_value) ?? facts?.next_charge_date ?? '',
      renewalPrice,
      currency,
      billingCycle,
      cancellationPath:
        getStringValue(fieldMap.cancellation_path?.extracted_value) ?? facts?.cancellation_path ?? '',
    },
    hints,
  }
}

export function validateSubscriptionForm(
  values: SubscriptionFormValues,
  variant: SubscriptionFormVariant,
): string[] {
  const errs: string[] = []
  const effectiveType = variant === 'trial' ? 'trial' : values.recordType

  if (!values.serviceName.trim()) errs.push('服务名称为必填项。')

  if (effectiveType === 'trial') {
    if (!values.membershipEndDate) {
      errs.push('试用结束日期为必填项。')
    } else if (!isValidDateOnly(values.membershipEndDate)) {
      errs.push('请输入有效的试用结束日期。')
    } else if (new Date(values.membershipEndDate + 'T00:00:00') < new Date(new Date().toDateString())) {
      errs.push('试用结束日期已经过去，请选择未来日期。')
    }
  }

  if (effectiveType === 'paid_membership') {
    const price = parseOptionalPrice(values.renewalPrice)
    if (price === null || price < 0) {
      errs.push('请输入有效价格。')
    }
    if (!values.currency) errs.push('币种为必填项。')
    if (!values.billingCycle) errs.push('计费周期为必填项。')
  }

  if (values.membershipStartDate && !isValidDateOnly(values.membershipStartDate)) {
    errs.push(effectiveType === 'trial' ? '请输入有效的试用开始日期。' : '请输入有效的开始日期。')
  }

  if (
    effectiveType === 'trial' &&
    values.membershipStartDate &&
    values.membershipEndDate &&
    isValidDateOnly(values.membershipStartDate) &&
    isValidDateOnly(values.membershipEndDate) &&
    values.membershipStartDate > values.membershipEndDate
  ) {
    errs.push('开始日期不能晚于试用结束日期')
  }

  if (values.membershipEndDate && !isValidDateOnly(values.membershipEndDate)) {
    errs.push('请输入有效的会员到期日期。')
  }

  if (values.nextChargeDate && !isValidDateOnly(values.nextChargeDate)) {
    errs.push('请输入有效的下次自动扣费日期。')
  }

  return errs
}

export function buildSubscriptionRecordFromFormValues(
  values: SubscriptionFormValues,
  options: BuildSubscriptionRecordFromFormOptions,
): SubscriptionRecord {
  const recordType = values.recordType
  const platform = resolvePlatform(values)

  const record = buildManualSubscriptionRecord({
    id: options.id,
    serviceName: values.serviceName.trim(),
    entitlementType: recordType,
    membershipStartDate: values.membershipStartDate || null,
    membershipEndDate: values.membershipEndDate || null,
    renewalStatus: values.renewalStatus,
    nextChargeDate: values.nextChargeDate || null,
    renewalPrice: parseOptionalPrice(values.renewalPrice),
    currency: values.currency || null,
    billingCycle: values.billingCycle || null,
    cancellationPath: values.renewalStatus === 'auto_renew_off' ? values.cancellationPath.trim() || null : null,
    platform,
    reminderOffsetDays: recordType === 'trial' ? 3 : 7,
    timestamp: options.timestamp,
  })

  return {
    facts: {
      ...record.facts,
      plan_name: values.planName.trim() || null,
      evidence_records:
        options.evidenceRecords && options.evidenceRecords.length > 0
          ? reconcileAiEvidenceWithSavedForm({
              evidenceRecords: options.evidenceRecords,
              values,
              confirmedAt: options.timestamp,
            })
          : [],
    },
  }
}

function mapFieldsByName(fields: readonly FieldEvidence[]): Partial<Record<SubscriptionFactFieldName, FieldEvidence>> {
  return fields.reduce<Partial<Record<SubscriptionFactFieldName, FieldEvidence>>>((map, field) => {
    map[field.field_name] = field
    return map
  }, {})
}

function getStringValue(value: ExtractedFieldValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function toRenewalStatus(value: string | null): RenewalStatus {
  return (
    value === 'auto_renew_on' ||
    value === 'auto_renew_off' ||
    value === 'manual_renewal' ||
    value === 'not_applicable' ||
    value === 'unknown'
  ) ? value : 'unknown'
}

function toBillingCycle(value: string | null): SubscriptionFactBillingCycle | '' {
  return (
    value === 'weekly' ||
    value === 'monthly' ||
    value === 'quarterly' ||
    value === 'yearly' ||
    value === 'custom'
  ) ? value : ''
}

function toRecordType(value: string | null): Extract<EntitlementType, 'trial' | 'paid_membership'> {
  return value === 'trial' ? 'trial' : 'paid_membership'
}

function parseOptionalPrice(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function resolvePlatform(values: SubscriptionFormValues): string | null {
  if (values.platformSelect === '__other__') {
    return values.customPlatform.trim() || null
  }

  return values.platformSelect || null
}

function mapPlatformToFormValues(platform: string): Pick<SubscriptionFormValues, 'platformSelect' | 'customPlatform'> {
  if (!platform) {
    return { platformSelect: '', customPlatform: '' }
  }

  const isPreset = MANUAL_PLATFORM_OPTIONS.some((option) => option.value === platform)
  return isPreset
    ? { platformSelect: platform, customPlatform: '' }
    : { platformSelect: '__other__', customPlatform: platform }
}

function getPricePrefill(field: FieldEvidence | undefined): {
  value: string
  currency: string | null
  hint: SubscriptionFormHint | null
} {
  if (!field) {
    return { value: '', currency: null, hint: null }
  }

  if (
    field.extracted_value &&
    typeof field.extracted_value === 'object' &&
    !Array.isArray(field.extracted_value)
  ) {
    const candidates =
      'candidates' in field.extracted_value && Array.isArray(field.extracted_value.candidates)
        ? field.extracted_value.candidates
            .filter((candidate) => typeof candidate === 'string' || typeof candidate === 'number')
            .map(String)
        : []
    const [primary, alternate] = candidates
    const currency =
      'currency' in field.extracted_value && typeof field.extracted_value.currency === 'string'
        ? field.extracted_value.currency
        : null
    return {
      value: primary ?? '',
      currency,
      hint: alternate
        ? {
            field: 'renewalPrice',
            message: `截图中存在不同价格，请确认金额。AI 还识别到另一处价格：¥${alternate}`,
            action: {
              label: `使用 ¥${alternate}`,
              apply: currency ? { renewalPrice: alternate, currency } : { renewalPrice: alternate },
            },
          }
        : {
            field: 'renewalPrice',
            message: '截图中存在不同价格，请确认金额。',
          },
    }
  }

  if (typeof field.extracted_value === 'number') {
    return { value: String(field.extracted_value), currency: null, hint: null }
  }

  if (typeof field.extracted_value === 'string') {
    return { value: field.extracted_value, currency: null, hint: null }
  }

  return { value: '', currency: null, hint: null }
}
