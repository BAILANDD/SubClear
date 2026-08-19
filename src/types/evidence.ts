export const EVIDENCE_TYPES = ['direct', 'inferred', 'missing', 'conflict', 'user_edited'] as const

export type EvidenceType = (typeof EVIDENCE_TYPES)[number]

export const REVIEW_STATUSES = ['ready', 'needs_review', 'missing', 'conflict', 'confirmed'] as const

export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type ExtractedFieldValue = JsonValue

export type EvidenceSourceType =
  | 'in_app_membership'
  | 'system_subscription'
  | 'order_detail'
  | 'payment_receipt'
  | 'notification'
  | 'customer_support'
  | 'membership_policy'
  | 'manual_entry'
  | 'unknown'

export type ExtractionMethod = 'fixture' | 'model' | 'manual'

export type EvidenceProcessingStatus = 'processing' | 'completed' | 'partial' | 'unsupported' | 'failed'

export type SubscriptionFactFieldName =
  | 'id'
  | 'service_name'
  | 'plan_name'
  | 'category'
  | 'platform'
  | 'entitlement_type'
  | 'membership_start_date'
  | 'membership_end_date'
  | 'renewal_status'
  | 'next_charge_date'
  | 'renewal_price'
  | 'currency'
  | 'billing_cycle'
  | 'cancellation_status'
  | 'cancellation_path'
  | 'cancellation_steps'
  | 'cancellation_deadline'
  | 'planned_cancel_date'
  | 'cancellation_completed_at'
  | 'cancellation_proof'
  | 'reminder_settings'

export interface FieldEvidence {
  field_name: SubscriptionFactFieldName
  extracted_value: ExtractedFieldValue
  source_text: string | null
  evidence_type: EvidenceType
  review_status: ReviewStatus
  model_confidence?: number
  is_inferred: boolean
  user_confirmed: boolean
  confirmed_at: string | null
}

export interface EvidenceRecord {
  evidence_id: string
  source_type: EvidenceSourceType
  file_name?: string | null
  fixture_reference?: string | null
  extraction_method: ExtractionMethod
  processing_status: EvidenceProcessingStatus
  created_at: string
  extracted_fields: FieldEvidence[]
}
