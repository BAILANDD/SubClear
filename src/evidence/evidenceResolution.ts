import {
  CANCELLATION_STATUSES,
  RENEWAL_STATUSES,
  type CancellationStatus,
  type EntitlementType,
  type ExtractedFieldValue,
  type FieldEvidence,
  type RenewalStatus,
  type SubscriptionFactBillingCycle,
  type SubscriptionFactFieldName,
  type SubscriptionFacts,
  type SubscriptionRecord,
} from '../types'

export interface SavedEvidenceTarget {
  evidenceId: string
  fieldName: SubscriptionFactFieldName
}

export interface ApplyEvidenceCandidateOptions extends SavedEvidenceTarget {
  value: ExtractedFieldValue
  updatedAt: string
}

export interface ClearSavedEvidenceCandidateOptions extends SavedEvidenceTarget {
  updatedAt: string
}

export interface ConfirmSavedEvidenceFieldOptions extends SavedEvidenceTarget {
  confirmedAt: string
}

export type EvidenceResolutionResult =
  | {
      ok: true
      record: SubscriptionRecord
    }
  | {
      ok: false
      reason: 'field_not_found' | 'invalid_value'
    }

export function applyEvidenceCandidate(
  record: SubscriptionRecord,
  options: ApplyEvidenceCandidateOptions,
): EvidenceResolutionResult {
  return updateEvidenceField(record, options, (field) => ({
    ...field,
    extracted_value: options.value,
    evidence_type: 'user_edited',
    review_status: 'needs_review',
    is_inferred: false,
    user_confirmed: false,
    confirmed_at: null,
  }))
}

export function clearSavedEvidenceCandidate(
  record: SubscriptionRecord,
  options: ClearSavedEvidenceCandidateOptions,
): EvidenceResolutionResult {
  return updateEvidenceField(record, options, (field) => ({
    ...field,
    extracted_value: null,
    evidence_type: 'missing',
    review_status: 'missing',
    is_inferred: false,
    user_confirmed: false,
    confirmed_at: null,
  }))
}

export function confirmSavedEvidenceField(
  record: SubscriptionRecord,
  options: ConfirmSavedEvidenceFieldOptions,
): EvidenceResolutionResult {
  const target = findEvidenceField(record, options)
  if (!target) return { ok: false, reason: 'field_not_found' }

  const patchResult = applyConfirmedFieldToFacts(record.facts, target.field)
  if (!patchResult.ok) return patchResult

  const updatedEvidence = updateEvidenceRecordFields(record, options, (field) => ({
    ...field,
    review_status: 'confirmed',
    user_confirmed: true,
    confirmed_at: options.confirmedAt,
  }))

  return {
    ok: true,
    record: {
      ...record,
      facts: {
        ...patchResult.facts,
        evidence_records: updatedEvidence,
        updated_at: options.confirmedAt,
      },
      metadata: record.metadata ? { ...record.metadata } : undefined,
    },
  }
}

export function applyConfirmedFieldToFacts(
  facts: SubscriptionFacts,
  field: FieldEvidence,
): { ok: true; facts: SubscriptionFacts } | { ok: false; reason: 'invalid_value' } {
  const value = field.extracted_value

  switch (field.field_name) {
    case 'id':
    case 'reminder_settings':
      return { ok: true, facts }
    case 'service_name': {
      const serviceName = getRequiredString(value)
      if (!serviceName) return { ok: false, reason: 'invalid_value' }
      return { ok: true, facts: { ...facts, service_name: serviceName } }
    }
    case 'plan_name':
    case 'category':
    case 'platform':
    case 'membership_start_date':
    case 'membership_end_date':
    case 'next_charge_date':
    case 'currency':
    case 'cancellation_path':
    case 'cancellation_deadline':
    case 'planned_cancel_date':
    case 'cancellation_completed_at':
    case 'cancellation_proof':
      return {
        ok: true,
        facts: {
          ...facts,
          [field.field_name]: getOptionalString(value),
        },
      }
    case 'entitlement_type': {
      const entitlementType = getEntitlementType(value)
      if (!entitlementType) return { ok: false, reason: 'invalid_value' }
      return { ok: true, facts: { ...facts, entitlement_type: entitlementType } }
    }
    case 'renewal_status': {
      const renewalStatus = getRenewalStatus(value)
      if (!renewalStatus) return { ok: false, reason: 'invalid_value' }
      return { ok: true, facts: { ...facts, renewal_status: renewalStatus } }
    }
    case 'renewal_price': {
      const renewalPrice = getOptionalNumber(value)
      if (renewalPrice === 'invalid') return { ok: false, reason: 'invalid_value' }
      return { ok: true, facts: { ...facts, renewal_price: renewalPrice } }
    }
    case 'billing_cycle': {
      const billingCycle = getBillingCycle(value)
      if (billingCycle === 'invalid') return { ok: false, reason: 'invalid_value' }
      return { ok: true, facts: { ...facts, billing_cycle: billingCycle } }
    }
    case 'cancellation_status': {
      const cancellationStatus = getCancellationStatus(value)
      if (!cancellationStatus) return { ok: false, reason: 'invalid_value' }
      return { ok: true, facts: { ...facts, cancellation_status: cancellationStatus } }
    }
    case 'cancellation_steps':
      return { ok: true, facts: { ...facts, cancellation_steps: getStringArray(value) } }
  }
}

function updateEvidenceField(
  record: SubscriptionRecord,
  target: SavedEvidenceTarget & { updatedAt: string },
  update: (field: FieldEvidence) => FieldEvidence,
): EvidenceResolutionResult {
  if (!findEvidenceField(record, target)) return { ok: false, reason: 'field_not_found' }

  return {
    ok: true,
    record: {
      ...record,
      facts: {
        ...record.facts,
        evidence_records: updateEvidenceRecordFields(record, target, update),
        updated_at: target.updatedAt,
      },
      metadata: record.metadata ? { ...record.metadata } : undefined,
    },
  }
}

function updateEvidenceRecordFields(
  record: SubscriptionRecord,
  target: SavedEvidenceTarget,
  update: (field: FieldEvidence) => FieldEvidence,
) {
  return record.facts.evidence_records.map((evidenceRecord) => {
    if (evidenceRecord.evidence_id !== target.evidenceId) {
      return {
        ...evidenceRecord,
        extracted_fields: evidenceRecord.extracted_fields.map((field) => ({ ...field })),
      }
    }

    return {
      ...evidenceRecord,
      extracted_fields: evidenceRecord.extracted_fields.map((field) =>
        field.field_name === target.fieldName ? update(field) : { ...field },
      ),
    }
  })
}

function findEvidenceField(record: SubscriptionRecord, target: SavedEvidenceTarget): { field: FieldEvidence } | null {
  const evidenceRecord = record.facts.evidence_records.find(
    (item) => item.evidence_id === target.evidenceId,
  )
  const field = evidenceRecord?.extracted_fields.find((item) => item.field_name === target.fieldName)
  return field ? { field } : null
}

function getRequiredString(value: ExtractedFieldValue): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getOptionalString(value: ExtractedFieldValue): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getOptionalNumber(value: ExtractedFieldValue): number | null | 'invalid' {
  if (value === null) return null
  return typeof value === 'number' && Number.isFinite(value) ? value : 'invalid'
}

function getStringArray(value: ExtractedFieldValue): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function getEntitlementType(value: ExtractedFieldValue): EntitlementType | null {
  return isOneOf(value, ['trial', 'paid_membership', 'one_time_purchase', 'lifetime', 'unknown'])
    ? value
    : null
}

function getRenewalStatus(value: ExtractedFieldValue): RenewalStatus | null {
  return isOneOf(value, RENEWAL_STATUSES) ? value : null
}

function getCancellationStatus(value: ExtractedFieldValue): CancellationStatus | null {
  return isOneOf(value, CANCELLATION_STATUSES) ? value : null
}

function getBillingCycle(value: ExtractedFieldValue): SubscriptionFactBillingCycle | null | 'invalid' {
  if (value === null) return null
  return isOneOf(value, ['weekly', 'monthly', 'quarterly', 'yearly', 'custom', 'unknown'])
    ? value
    : 'invalid'
}

function isOneOf<const T extends readonly string[]>(
  value: ExtractedFieldValue,
  allowed: T,
): value is T[number] {
  return typeof value === 'string' && allowed.includes(value)
}
