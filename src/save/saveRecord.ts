import { CURRENT_SCHEMA_VERSION, type SubscriptionRecord } from '../types/storage'
import type { CaptureSessionDraft } from '../types/capture'
import type { ExtractedFieldValue, FieldEvidence, SubscriptionFactFieldName } from '../types/evidence'
import type {
  CancellationStatus,
  EntitlementType,
  RenewalStatus,
  SubscriptionFactBillingCycle,
  SubscriptionFacts,
} from '../types/subscription'
import { isFieldEvidenceUnresolved } from '../selectors/subscriptions'

const OPTIONAL_MISSING_FIELDS = new Set<SubscriptionFactFieldName>([
  'category',
  'platform',
  'membership_start_date',
  'currency',
  'billing_cycle',
  'cancellation_path',
])

export type SaveValidationResult =
  | {
      status: 'valid_complete'
    }
  | {
      status: 'valid_incomplete'
      unresolved_count: number
    }
  | {
      status: 'missing_required_identity'
      message: string
    }

export interface BuildSubscriptionRecordOptions {
  id: string
  savedAt: string
}

export function validateReviewForSave(draft: CaptureSessionDraft): SaveValidationResult {
  const serviceNameField = findField(draft.review_fields, 'service_name')
  if (
    !serviceNameField ||
    typeof serviceNameField.extracted_value !== 'string' ||
    serviceNameField.extracted_value.trim().length === 0 ||
    serviceNameField.review_status !== 'confirmed' ||
    !serviceNameField.user_confirmed
  ) {
    return {
      status: 'missing_required_identity',
      message: '请先确认服务名称，再保存记录。',
    }
  }

  const unresolvedCount = draft.review_fields.filter(isBlockingUnresolvedField).length
  if (unresolvedCount > 0) {
    return {
      status: 'valid_incomplete',
      unresolved_count: unresolvedCount,
    }
  }

  return {
    status: 'valid_complete',
  }
}

function isBlockingUnresolvedField(field: FieldEvidence): boolean {
  if (
    field.review_status === 'missing' &&
    field.evidence_type === 'missing' &&
    OPTIONAL_MISSING_FIELDS.has(field.field_name)
  ) {
    return false
  }

  return isFieldEvidenceUnresolved(field)
}

export function buildSubscriptionRecordFromReview(
  draft: CaptureSessionDraft,
  options: BuildSubscriptionRecordOptions,
): SubscriptionRecord {
  const confirmedValues = collectConfirmedValues(draft.review_fields)
  const facts: SubscriptionFacts = {
    id: options.id,
    service_name: getRequiredString(confirmedValues.service_name),
    plan_name: getOptionalString(confirmedValues.plan_name),
    category: getOptionalString(confirmedValues.category),
    platform: getOptionalString(confirmedValues.platform),
    entitlement_type: getEntitlementType(confirmedValues.entitlement_type),
    membership_start_date: getOptionalString(confirmedValues.membership_start_date),
    membership_end_date: getOptionalString(confirmedValues.membership_end_date),
    renewal_status: getRenewalStatus(confirmedValues.renewal_status),
    next_charge_date: getOptionalString(confirmedValues.next_charge_date),
    renewal_price: getOptionalNumber(confirmedValues.renewal_price),
    currency: getOptionalString(confirmedValues.currency),
    billing_cycle: getBillingCycle(confirmedValues.billing_cycle),
    cancellation_status: getCancellationStatus(confirmedValues.cancellation_status),
    cancellation_path: getOptionalString(confirmedValues.cancellation_path),
    cancellation_steps: getStringArray(confirmedValues.cancellation_steps),
    cancellation_deadline: getOptionalString(confirmedValues.cancellation_deadline),
    planned_cancel_date: getOptionalString(confirmedValues.planned_cancel_date),
    cancellation_completed_at: getOptionalString(confirmedValues.cancellation_completed_at),
    cancellation_proof: getOptionalString(confirmedValues.cancellation_proof),
    reminder_settings: {
      enabled: true,
      offset_days: 7,
      state: 'enabled',
    },
    evidence_records:
      draft.draft_record?.evidence_records.map((record) => ({
        ...record,
        extracted_fields: record.extracted_fields.map((field) => ({ ...field })),
      })) ?? [],
    schema_version: CURRENT_SCHEMA_VERSION,
    created_at: options.savedAt,
    updated_at: options.savedAt,
  }

  return { facts }
}

function collectConfirmedValues(fields: readonly FieldEvidence[]): Partial<Record<SubscriptionFactFieldName, ExtractedFieldValue>> {
  return fields.reduce<Partial<Record<SubscriptionFactFieldName, ExtractedFieldValue>>>((values, field) => {
    if (field.review_status === 'confirmed' && field.user_confirmed) {
      values[field.field_name] = field.extracted_value
    }
    return values
  }, {})
}

function findField(fields: readonly FieldEvidence[], fieldName: SubscriptionFactFieldName): FieldEvidence | undefined {
  return fields.find((field) => field.field_name === fieldName)
}

function getRequiredString(value: ExtractedFieldValue | undefined): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

function getOptionalString(value: ExtractedFieldValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getOptionalNumber(value: ExtractedFieldValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getStringArray(value: ExtractedFieldValue | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function getEntitlementType(value: ExtractedFieldValue | undefined): EntitlementType {
  return isOneOf(value, ['trial', 'paid_membership', 'one_time_purchase', 'lifetime', 'unknown'])
    ? value
    : 'unknown'
}

function getRenewalStatus(value: ExtractedFieldValue | undefined): RenewalStatus {
  return isOneOf(value, [
    'auto_renew_on',
    'auto_renew_off',
    'manual_renewal',
    'not_applicable',
    'unknown',
  ])
    ? value
    : 'unknown'
}

function getCancellationStatus(value: ExtractedFieldValue | undefined): CancellationStatus {
  return isOneOf(value, ['none', 'planned', 'in_progress', 'confirmed']) ? value : 'none'
}

function getBillingCycle(value: ExtractedFieldValue | undefined): SubscriptionFactBillingCycle | null {
  return isOneOf(value, ['weekly', 'monthly', 'quarterly', 'yearly', 'custom', 'unknown'])
    ? value
    : null
}

function isOneOf<const T extends readonly string[]>(
  value: ExtractedFieldValue | undefined,
  allowed: T,
): value is T[number] {
  return typeof value === 'string' && allowed.includes(value)
}
