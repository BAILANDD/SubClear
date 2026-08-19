import type {
  EvidenceType,
  ExtractedFieldValue,
  FieldEvidence,
  ReviewStatus,
  SubscriptionFactFieldName,
} from '../types/evidence'
import type {
  RenewalStatus,
  SubscriptionFactBillingCycle,
} from '../types/subscription'

// ---------------------------------------------------------------------------
// AI Extraction – field-level wrapper
// ---------------------------------------------------------------------------

/**
 * Every field extracted by the AI carries its own value + evidence metadata.
 *
 * The AI MUST NOT produce `review_status: 'confirmed'` or
 * `evidence_type: 'user_edited'` — those are reserved for the
 * human-confirmation trust boundary in Review.
 */
export interface AiExtractionField<T extends ExtractedFieldValue> {
  /** The extracted value, or null when nothing could be read. */
  value: T | null

  /** How the value was obtained from the screenshot. */
  evidence_type: Exclude<EvidenceType, 'user_edited'>

  /** Initial review recommendation from the AI. */
  review_status: Exclude<ReviewStatus, 'confirmed'>

  /** Verbatim text or visual cue the AI relied on. */
  source_text: string | null

  /** True when the AI inferred this fact rather than reading it directly. */
  is_inferred: boolean

  /**
   * Model confidence 0–1.
   * Mirrors the existing `model_confidence` on FieldEvidence.
   * Optional — only present when the model provides it.
   */
  confidence?: number
}

// ---------------------------------------------------------------------------
// AI Extraction – top-level DTO
// ---------------------------------------------------------------------------

export const AI_EXTRACTION_SCHEMA_VERSION = '1.0' as const

/**
 * Structured output the multimodal model MUST return.
 *
 * This is NOT a SubscriptionRecord.  It is a *draft* that flows
 * through validation → normalization → Review → human confirmation
 * before any canonical fact is written.
 */
export interface AiSubscriptionExtraction {
  /** AI contract version, independent of storage schema version. */
  schema_version: typeof AI_EXTRACTION_SCHEMA_VERSION

  fields: {
    service_name: AiExtractionField<string>
    plan_name: AiExtractionField<string>
    category: AiExtractionField<string>
    platform: AiExtractionField<string>
    membership_start_date: AiExtractionField<string>
    membership_end_date: AiExtractionField<string>
    renewal_status: AiExtractionField<RenewalStatus>
    next_charge_date: AiExtractionField<string>
    price_amount: AiExtractionField<number>
    currency: AiExtractionField<string>
    billing_period: AiExtractionField<SubscriptionFactBillingCycle>
    cancellation_path: AiExtractionField<string>
  }
}

// ---------------------------------------------------------------------------
// Convenience: all field names
// ---------------------------------------------------------------------------

export const AI_EXTRACTION_FIELD_NAMES = [
  'service_name',
  'plan_name',
  'category',
  'platform',
  'membership_start_date',
  'membership_end_date',
  'renewal_status',
  'next_charge_date',
  'price_amount',
  'currency',
  'billing_period',
  'cancellation_path',
] as const

export type AiExtractionFieldName = (typeof AI_EXTRACTION_FIELD_NAMES)[number]

// ---------------------------------------------------------------------------
// Extraction Issues — model error vs source missing separation
// ---------------------------------------------------------------------------

/**
 * Finite, explicit issue codes for AI extraction processing problems.
 * These are processing metadata — they NEVER enter canonical SubscriptionFacts.
 */
export const AI_EXTRACTION_ISSUE_CODES = [
  'invalid_date',
  'invalid_number',
  'invalid_enum',
  'invalid_field_state',
  'semantic_conflict',
  'missing_currency',
  'renewal_charge_conflict',
  'date_range_conflict',
] as const

export type AiExtractionIssueCode = (typeof AI_EXTRACTION_ISSUE_CODES)[number]

export type AiExtractionIssueSeverity = 'warning' | 'error'

/**
 * A processing issue detected during normalization or semantic checking.
 *
 * - `field`  — which AI field this applies to
 * - `code`   — machine-readable issue category
 * - `message` — human-readable description
 * - `raw_value` — the original model output value (if applicable), preserved for Review UI
 * - `severity`  — warning (user should confirm) or error (contract/semantic violation)
 */
export interface AiExtractionIssue {
  field: AiExtractionFieldName
  code: AiExtractionIssueCode
  message: string
  raw_value?: unknown
  severity: AiExtractionIssueSeverity
}

// ---------------------------------------------------------------------------
// Processed Extraction — richer result with issues
// ---------------------------------------------------------------------------

/**
 * The complete result of the AI extraction processing pipeline.
 *
 * `fields` — FieldEvidence[] ready for Review (same shape as fixture)
 * `issues` — all processing/semantic issues detected
 * `extraction` — the validated & normalized extraction DTO
 */
export interface ProcessedAiExtraction {
  fields: FieldEvidence[]
  issues: AiExtractionIssue[]
  extraction: AiSubscriptionExtraction
}

// ---------------------------------------------------------------------------
// Mapping: AI field name → canonical SubscriptionFactFieldName
// ---------------------------------------------------------------------------

/**
 * Most AI field names match canonical fact field names directly.
 * The exceptions are price_amount → renewal_price and
 * billing_period → billing_cycle.
 */
export const AI_TO_CANONICAL_FIELD: Record<
  AiExtractionFieldName,
  SubscriptionFactFieldName
> = {
  service_name: 'service_name',
  plan_name: 'plan_name',
  category: 'category',
  platform: 'platform',
  membership_start_date: 'membership_start_date',
  membership_end_date: 'membership_end_date',
  renewal_status: 'renewal_status',
  next_charge_date: 'next_charge_date',
  price_amount: 'renewal_price',
  currency: 'currency',
  billing_period: 'billing_cycle',
  cancellation_path: 'cancellation_path',
}
