import type {
  EvidenceType,
  ExtractedFieldValue,
  FieldEvidence,
  ReviewStatus,
} from '../types/evidence'
import type { RenewalStatus } from '../types/subscription'
import { validateAiExtraction } from './extractionSchema'
import {
  AI_TO_CANONICAL_FIELD,
  type AiExtractionField,
  type AiExtractionFieldName,
  type AiExtractionIssue,
  type AiSubscriptionExtraction,
  type ProcessedAiExtraction,
} from './extractionTypes'

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type NormalizeExtractionResult =
  | {
      ok: true
      fields: FieldEvidence[]
      extraction: AiSubscriptionExtraction
      normalizationIssues: AiExtractionIssue[]
    }
  | {
      ok: false
      errors: string[]
    }

export type ProcessedExtractionResult =
  | {
      ok: true
      result: ProcessedAiExtraction
    }
  | {
      ok: false
      errors: string[]
    }

// ---------------------------------------------------------------------------
// Pipeline entry points
// ---------------------------------------------------------------------------

/**
 * Lean pipeline — fields only (backward compatible with AI-01).
 */
export function processAiExtractionResponse(
  raw: unknown,
): NormalizeExtractionResult {
  const result = processAiExtractionResponseDetailed(raw)
  if (!result.ok) return result
  return {
    ok: true,
    fields: result.result.fields,
    extraction: result.result.extraction,
    normalizationIssues: result.result.issues,
  }
}

/**
 * Rich pipeline — fields + issues.
 *
 *   Raw AI Response
 *   → validateAiExtraction
 *   → normalizeAiExtractionFields
 *   → checkExtractionConsistency
 *   → ProcessedAiExtraction { fields, issues }
 */
export function processAiExtractionResponseDetailed(
  raw: unknown,
): ProcessedExtractionResult {
  const validated = validateAiExtraction(raw)
  if (!validated.ok) {
    return {
      ok: false,
      errors: validated.errors.map(
        (e) => `${e.field ?? '$root'}: ${e.message}`,
      ),
    }
  }

  return processValidatedExtraction(validated.extraction)
}

/**
 * Process an already-validated extraction through normalization + consistency.
 */
export function processValidatedExtraction(
  extraction: AiSubscriptionExtraction,
): ProcessedExtractionResult {
  const normalized = normalizeAiExtractionFields(extraction)
  if (!normalized.ok) return normalized

  // Run consistency checker, passing in normalization issues as the base
  return checkExtractionConsistency(
    normalized.fields,
    normalized.extraction,
    normalized.normalizationIssues,
  )
}

/**
 * Normalize a validated extraction DTO into FieldEvidence[].
 */
export function normalizeAiExtractionFields(
  extraction: AiSubscriptionExtraction,
): NormalizeExtractionResult {
  const fields: FieldEvidence[] = []
  const normalizationIssues: AiExtractionIssue[] = []

  const normalizedExtraction: AiSubscriptionExtraction = {
    schema_version: extraction.schema_version,
    fields: {} as AiSubscriptionExtraction['fields'],
  }

  for (const aiFieldName of Object.keys(extraction.fields) as AiExtractionFieldName[]) {
    const rawField = extraction.fields[aiFieldName]
    const canonicalFieldName = AI_TO_CANONICAL_FIELD[aiFieldName]

    const normalized = normalizeField(aiFieldName, rawField)

    if (normalized.issue) {
      normalizationIssues.push(normalized.issue)
    }

    ;(normalizedExtraction.fields as Record<string, AiExtractionField<ExtractedFieldValue>>)[aiFieldName] =
      normalized.normalized

    fields.push({
      field_name: canonicalFieldName,
      extracted_value: normalized.value,
      source_text: normalized.normalized.source_text,
      evidence_type: normalized.normalized.evidence_type,
      review_status: normalized.normalized.review_status,
      model_confidence: normalized.normalized.confidence,
      is_inferred: normalized.normalized.is_inferred,
      user_confirmed: false,
      confirmed_at: null,
    })
  }

  return { ok: true, fields, extraction: normalizedExtraction, normalizationIssues }
}

// ---------------------------------------------------------------------------
// Per-field normalization (with issue tracking)
// ---------------------------------------------------------------------------

interface NormalizedField {
  normalized: AiExtractionField<ExtractedFieldValue>
  value: ExtractedFieldValue
  /** Non-null when normalization invalidated the model's value. */
  issue: AiExtractionIssue | null
}

/**
 * Normalize a single AI extraction field.
 *
 * **Model error vs source missing:**
 * - Source missing: the model correctly reports `evidence_type = missing, value = null`
 *   → preserved as missing, **no issue**
 * - Model error: model claims `direct`/`inferred` but the value is invalid
 *   → value set to null, review set to `needs_review`, **issue recorded with raw_value**
 */
function normalizeField(
  fieldName: AiExtractionFieldName,
  field: AiExtractionField<ExtractedFieldValue>,
): NormalizedField {
  let value: ExtractedFieldValue = field.value
  const evidenceType: EvidenceType = field.evidence_type
  let reviewStatus: ReviewStatus = field.review_status
  let issue: AiExtractionIssue | null = null
  const originalValue = field.value

  // ------------------------------------------------------------------
  // String normalization
  // ------------------------------------------------------------------
  if (typeof value === 'string') {
    const trimmed = value.trim()

    if (fieldName === 'currency') {
      value = (trimmed || null) as ExtractedFieldValue
      if (value && typeof value === 'string') {
        value = value.toUpperCase() as ExtractedFieldValue
      }
    } else if (
      fieldName === 'service_name' ||
      fieldName === 'plan_name' ||
      fieldName === 'category' ||
      fieldName === 'platform' ||
      fieldName === 'cancellation_path'
    ) {
      value = trimmed ? (trimmed as ExtractedFieldValue) : null
    } else if (
      fieldName === 'membership_start_date' ||
      fieldName === 'membership_end_date' ||
      fieldName === 'next_charge_date'
    ) {
      if (trimmed && !isValidDateOnly(trimmed)) {
        // Model error: bad date format
        issue = makeIssue(fieldName, 'invalid_date', `Date "${trimmed}" is not valid YYYY-MM-DD.`, trimmed)
        value = null
        reviewStatus = 'needs_review'
      } else if (trimmed) {
        value = trimmed as ExtractedFieldValue
      } else {
        value = null
      }
    }
  }

  // ------------------------------------------------------------------
  // renewal_status: validate enum
  // ------------------------------------------------------------------
  if (fieldName === 'renewal_status' && value !== null) {
    if (typeof value !== 'string' || !isRenewalStatus(value)) {
      issue = makeIssue(
        fieldName,
        'invalid_enum',
        `Renewal status "${String(value)}" is not a valid enum value.`,
        originalValue,
      )
      value = null
      reviewStatus = 'needs_review'
    }
  }

  // ------------------------------------------------------------------
  // price_amount: validate number
  // ------------------------------------------------------------------
  if (fieldName === 'price_amount' && value !== null) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      issue = makeIssue(
        fieldName,
        'invalid_number',
        `Price ${JSON.stringify(originalValue)} is not a valid non-negative number.`,
        originalValue,
      )
      value = null
      reviewStatus = 'needs_review'
    }
  }

  // ------------------------------------------------------------------
  // billing_period: validate enum
  // ------------------------------------------------------------------
  if (fieldName === 'billing_period' && value !== null) {
    if (typeof value !== 'string' || !isBillingPeriod(value)) {
      issue = makeIssue(
        fieldName,
        'invalid_enum',
        `Billing period "${String(value)}" is not a valid value.`,
        originalValue,
      )
      value = null
      reviewStatus = 'needs_review'
    }
  }

  // ------------------------------------------------------------------
  // Handle genuine missing: model says value=null AND evidence=missing
  // AND normalization didn't flag any issue.
  // This is legitimate source missing — no issue.
  // If normalization produced an issue (e.g. invalid_date), the
  // issue-driven review_status takes priority.
  // ------------------------------------------------------------------
  if (value === null && evidenceType === 'missing' && issue === null) {
    reviewStatus = 'missing'
  }

  return {
    normalized: {
      value,
      evidence_type: evidenceType,
      review_status: reviewStatus,
      source_text: field.source_text,
      is_inferred: field.is_inferred,
      confidence: field.confidence,
    },
    value,
    issue,
  }
}

// ---------------------------------------------------------------------------
// Semantic Consistency Checker
// ---------------------------------------------------------------------------

/**
 * Runs field-state rules and cross-field semantic rules against
 * normalized fields. Returns enriched fields + all accumulated issues.
 */
export function checkExtractionConsistency(
  fields: FieldEvidence[],
  extraction: AiSubscriptionExtraction,
  baseIssues: AiExtractionIssue[] = [],
): ProcessedExtractionResult {
  const issues: AiExtractionIssue[] = [...baseIssues]

  // Field-state consistency rules (per-field)
  for (const field of fields) {
    const aiFieldName = canonicalToAiField(field.field_name)
    if (!aiFieldName) continue

    const aiField = extraction.fields[aiFieldName]

    // Rule 1: null + direct/ready → invalid_field_state
    if (
      field.extracted_value === null &&
      field.evidence_type !== 'missing' &&
      field.review_status !== 'missing'
    ) {
      issues.push(makeIssue(
        aiFieldName,
        'invalid_field_state',
        'Value is null but evidence_type is not missing — field state inconsistent.',
        null,
      ))
      if (field.review_status !== 'needs_review') {
        field.review_status = 'needs_review'
      }
    }

    // Rule 2: non-null value + missing evidence → invalid_field_state
    if (
      field.extracted_value !== null &&
      field.evidence_type === 'missing'
    ) {
      issues.push(makeIssue(
        aiFieldName,
        'invalid_field_state',
        'Value present but evidence_type is missing — inconsistent.',
        field.extracted_value,
      ))
      field.review_status = 'needs_review'
    }

    // Rule 3: non-null value + missing review → invalid_field_state
    if (
      field.extracted_value !== null &&
      field.review_status === 'missing'
    ) {
      issues.push(makeIssue(
        aiFieldName,
        'invalid_field_state',
        'Value present but review_status is missing — inconsistent.',
        field.extracted_value,
      ))
      field.review_status = 'needs_review'
    }

    // Rule 4: conflict evidence + ready review → conflict
    if (
      field.evidence_type === 'conflict' &&
      field.review_status === 'ready'
    ) {
      issues.push(makeIssue(
        aiFieldName,
        'invalid_field_state',
        'evidence_type is conflict but review_status is ready — corrected to conflict.',
        null,
      ))
      field.review_status = 'conflict'
    }

    // Rule 5: inferred → default to needs_review (unless already needs_review/conflict)
    if (
      aiField.evidence_type === 'inferred' &&
      field.review_status !== 'needs_review' &&
      field.review_status !== 'conflict' &&
      field.review_status !== 'missing'
    ) {
      field.review_status = 'needs_review'
    }
  }

  // ------------------------------------------------------------------
  // Cross-field semantic rules
  // ------------------------------------------------------------------

  const renewalStatus = findFieldValue<string>(fields, 'renewal_status') as RenewalStatus | null
  const nextChargeField = findField(fields, 'next_charge_date')
  const nextChargeValue = nextChargeField?.extracted_value as string | null
  const nextChargeReady = nextChargeField?.review_status === 'ready'

  // Rule 6.1: auto_renew_on + next_charge → always legal
  //   (nothing to do)

  // Rule 6.2: auto_renew_off + ready next_charge → conflict
  if (
    renewalStatus === 'auto_renew_off' &&
    nextChargeValue !== null &&
    nextChargeReady
  ) {
    issues.push(makeIssue(
      'next_charge_date',
      'renewal_charge_conflict',
      'Renewal is off but a ready next_charge_date exists.',
      nextChargeValue,
    ))
    if (nextChargeField) nextChargeField.review_status = 'conflict'
  }

  // Rule 6.3: manual_renewal + ready next_charge → conflict
  if (
    renewalStatus === 'manual_renewal' &&
    nextChargeValue !== null &&
    nextChargeReady
  ) {
    issues.push(makeIssue(
      'next_charge_date',
      'renewal_charge_conflict',
      'Manual renewal but a ready next_charge_date exists.',
      nextChargeValue,
    ))
    if (nextChargeField) nextChargeField.review_status = 'conflict'
  }

  // Rule 6.4: not_applicable + ready next_charge → conflict
  if (
    renewalStatus === 'not_applicable' &&
    nextChargeValue !== null &&
    nextChargeReady
  ) {
    issues.push(makeIssue(
      'next_charge_date',
      'renewal_charge_conflict',
      'Renewal not applicable but a ready next_charge_date exists.',
      nextChargeValue,
    ))
    if (nextChargeField) nextChargeField.review_status = 'conflict'
  }

  // Rule 6.5: unknown renewal + next_charge → keep candidate but needs_review
  if (
    renewalStatus === 'unknown' &&
    nextChargeValue !== null
  ) {
    issues.push(makeIssue(
      'next_charge_date',
      'semantic_conflict',
      'Renewal status unknown — next charge date retained as candidate for review.',
      nextChargeValue,
    ))
    if (nextChargeField && nextChargeField.review_status === 'ready') {
      nextChargeField.review_status = 'needs_review'
    }
  }

  // Rule 7: start_date > end_date → date_range_conflict
  const startDate = findFieldValue<string>(fields, 'membership_start_date')
  const endDate = findFieldValue<string>(fields, 'membership_end_date')
  if (startDate && endDate && isValidDateOnly(startDate) && isValidDateOnly(endDate)) {
    if (startDate > endDate) {
      issues.push(makeIssue(
        'membership_start_date',
        'date_range_conflict',
        `Start date ${startDate} is after end date ${endDate}.`,
        { start: startDate, end: endDate },
      ))
      issues.push(makeIssue(
        'membership_end_date',
        'date_range_conflict',
        `End date ${endDate} is before start date ${startDate}.`,
        { start: startDate, end: endDate },
      ))
      const startField = findField(fields, 'membership_start_date')
      const endField = findField(fields, 'membership_end_date')
      if (startField) startField.review_status = 'conflict'
      if (endField) endField.review_status = 'conflict'
    }
  }

  // Rule 8: price present + currency missing → missing_currency
  const priceValue = findFieldValue<number>(fields, 'renewal_price')
  const currencyValue = findFieldValue<string>(fields, 'currency')
  if (priceValue !== null && currencyValue === null) {
    const priceField = findField(fields, 'renewal_price')
    issues.push(makeIssue(
      'price_amount',
      'missing_currency',
      'Price amount present but currency is missing.',
      priceValue,
    ))
    if (priceField && priceField.review_status === 'ready') {
      priceField.review_status = 'needs_review'
    }
  }

  return {
    ok: true,
    result: { fields, issues, extraction },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIssue(
  field: AiExtractionFieldName,
  code: AiExtractionIssue['code'],
  message: string,
  raw_value?: unknown,
): AiExtractionIssue {
  return {
    field,
    code,
    message,
    raw_value,
    severity: code === 'invalid_field_state' || code === 'semantic_conflict'
      ? 'warning'
      : code === 'renewal_charge_conflict' || code === 'date_range_conflict'
        ? 'warning'
        : 'error',
  }
}

function findField(fields: FieldEvidence[], fieldName: string): FieldEvidence | undefined {
  return fields.find((f) => f.field_name === fieldName)
}

function findFieldValue<T>(fields: FieldEvidence[], fieldName: string): T | null {
  const field = findField(fields, fieldName)
  return (field?.extracted_value as T) ?? null
}

function canonicalToAiField(canonical: string): AiExtractionFieldName | null {
  for (const [ai, canon] of Object.entries(AI_TO_CANONICAL_FIELD)) {
    if (canon === canonical) return ai as AiExtractionFieldName
  }
  return null
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const VALID_RENEWAL: ReadonlySet<string> = new Set([
  'auto_renew_on',
  'auto_renew_off',
  'manual_renewal',
  'not_applicable',
  'unknown',
])

function isRenewalStatus(value: string): value is RenewalStatus {
  return VALID_RENEWAL.has(value)
}

const VALID_BILLING: ReadonlySet<string> = new Set([
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
  'unknown',
])

function isBillingPeriod(value: string): boolean {
  return VALID_BILLING.has(value)
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))

  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}
