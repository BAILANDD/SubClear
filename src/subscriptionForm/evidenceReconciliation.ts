import type {
  EvidenceRecord,
  ExtractedFieldValue,
  FieldEvidence,
  SubscriptionFactFieldName,
} from '../types/evidence'
import type { SubscriptionFormValues } from './subscriptionFormCore'

interface ReconcileAiEvidenceOptions {
  evidenceRecords: readonly EvidenceRecord[]
  values: SubscriptionFormValues
  confirmedAt: string
}

export function reconcileAiEvidenceWithSavedForm({
  evidenceRecords,
  values,
  confirmedAt,
}: ReconcileAiEvidenceOptions): EvidenceRecord[] {
  return evidenceRecords.map((record) => ({
    ...record,
    extracted_fields: record.extracted_fields.map((field) =>
      reconcileFieldWithSavedForm(field, values, confirmedAt),
    ),
  }))
}

function reconcileFieldWithSavedForm(
  field: FieldEvidence,
  values: SubscriptionFormValues,
  confirmedAt: string,
): FieldEvidence {
  const savedValue = getSavedFormValue(field.field_name, values)

  if (savedValue === undefined) {
    return { ...field }
  }

  if (isBlankSavedValue(savedValue)) {
    if (field.evidence_type === 'missing' && field.review_status === 'missing') {
      return {
        ...field,
        review_status: 'confirmed',
        user_confirmed: true,
        confirmed_at: confirmedAt,
      }
    }

    return {
      ...field,
      extracted_value: null,
      evidence_type: 'user_edited',
      review_status: 'confirmed',
      user_confirmed: true,
      confirmed_at: confirmedAt,
    }
  }

  const didUserChangeValue = !valuesEquivalent(field.extracted_value, savedValue)

  return {
    ...field,
    extracted_value: didUserChangeValue ? savedValue : field.extracted_value,
    evidence_type: didUserChangeValue ? 'user_edited' : field.evidence_type,
    review_status: 'confirmed',
    user_confirmed: true,
    confirmed_at: confirmedAt,
  }
}

function getSavedFormValue(
  fieldName: SubscriptionFactFieldName,
  values: SubscriptionFormValues,
): ExtractedFieldValue | undefined {
  switch (fieldName) {
    case 'service_name':
      return values.serviceName.trim()
    case 'plan_name':
      return values.planName.trim() || null
    case 'platform':
      return resolvePlatform(values)
    case 'entitlement_type':
      return values.recordType
    case 'membership_start_date':
      return values.membershipStartDate || null
    case 'membership_end_date':
      return values.membershipEndDate || null
    case 'renewal_status':
      return values.renewalStatus
    case 'next_charge_date':
      return values.renewalStatus === 'auto_renew_on' ? values.nextChargeDate || null : null
    case 'renewal_price':
      return parseOptionalPrice(values.renewalPrice)
    case 'currency':
      return values.currency || null
    case 'billing_cycle':
      return values.billingCycle || null
    case 'cancellation_path':
      return values.renewalStatus === 'auto_renew_off' ? values.cancellationPath.trim() || null : null
    default:
      return undefined
  }
}

function isBlankSavedValue(value: ExtractedFieldValue): boolean {
  return value === null || value === ''
}

function valuesEquivalent(candidate: ExtractedFieldValue, savedValue: ExtractedFieldValue): boolean {
  if (candidate === savedValue) {
    return true
  }

  if (typeof candidate === 'number' || typeof savedValue === 'number') {
    const candidateNumber = typeof candidate === 'number' ? candidate : Number(candidate)
    const savedNumber = typeof savedValue === 'number' ? savedValue : Number(savedValue)
    return Number.isFinite(candidateNumber) && Number.isFinite(savedNumber) && candidateNumber === savedNumber
  }

  return String(candidate ?? '') === String(savedValue ?? '')
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
