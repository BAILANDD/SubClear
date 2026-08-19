import { EVIDENCE_TYPES, REVIEW_STATUSES } from '../types/evidence'
import { AI_EXTRACTION_FIELD_NAMES, AI_EXTRACTION_SCHEMA_VERSION } from './extractionTypes'
import type {
  AiExtractionFieldName,
  AiSubscriptionExtraction,
} from './extractionTypes'

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

export type ExtractionValidationResult =
  | { ok: true; extraction: AiSubscriptionExtraction }
  | { ok: false; errors: ExtractionValidationError[] }

export interface ExtractionValidationError {
  field?: AiExtractionFieldName | '$root'
  message: string
}

// ---------------------------------------------------------------------------
// JSON Schema (for documentation & structured-output prompting)
// ---------------------------------------------------------------------------

const FIELD_SCHEMA = {
  type: 'object',
  properties: {
    value: {},
    evidence_type: { type: 'string', enum: ['direct', 'inferred', 'missing', 'conflict'] },
    review_status: { type: 'string', enum: ['ready', 'needs_review', 'missing', 'conflict'] },
    source_text: { type: ['string', 'null'] },
    is_inferred: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['value', 'evidence_type', 'review_status', 'source_text', 'is_inferred'],
  additionalProperties: false,
} as const

export const AI_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    schema_version: { type: 'string', const: AI_EXTRACTION_SCHEMA_VERSION },
    fields: {
      type: 'object',
      properties: Object.fromEntries(
        AI_EXTRACTION_FIELD_NAMES.map((name) => [name, FIELD_SCHEMA]),
      ),
      required: AI_EXTRACTION_FIELD_NAMES,
      additionalProperties: false,
    },
  },
  required: ['schema_version', 'fields'],
  additionalProperties: false,
} as const

// ---------------------------------------------------------------------------
// Runtime validation
// ---------------------------------------------------------------------------

const VALID_EVIDENCE_TYPES: ReadonlySet<string> = new Set(
  EVIDENCE_TYPES.filter((t) => t !== 'user_edited'),
)
const VALID_REVIEW_STATUSES: ReadonlySet<string> = new Set(
  REVIEW_STATUSES.filter((s) => s !== 'confirmed'),
)

export function validateAiExtraction(
  raw: unknown,
): ExtractionValidationResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: [{ field: '$root', message: 'Expected a JSON object.' }] }
  }

  const obj = raw as Record<string, unknown>

  // schema_version
  if (obj.schema_version !== AI_EXTRACTION_SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        {
          field: '$root',
          message: `schema_version must be "${AI_EXTRACTION_SCHEMA_VERSION}".`,
        },
      ],
    }
  }

  // fields must be an object
  if (typeof obj.fields !== 'object' || obj.fields === null) {
    return {
      ok: false,
      errors: [{ field: '$root', message: '"fields" must be a non-null object.' }],
    }
  }

  const fields = obj.fields as Record<string, unknown>
  const errors: ExtractionValidationError[] = []

  // Check no extra top-level keys
  for (const key of Object.keys(obj)) {
    if (key !== 'schema_version' && key !== 'fields') {
      errors.push({ field: '$root', message: `Unexpected top-level key "${key}".` })
    }
  }

  // Check no extra fields keys
  const validFieldNames = new Set<string>(AI_EXTRACTION_FIELD_NAMES)
  for (const key of Object.keys(fields)) {
    if (!validFieldNames.has(key)) {
      errors.push({ field: '$root', message: `Unexpected field "${key}" in fields.` })
    }
  }

  // Validate each expected field
  const typedFields = {} as Record<AiExtractionFieldName, Record<string, unknown>>

  for (const fieldName of AI_EXTRACTION_FIELD_NAMES) {
    const rawField = fields[fieldName]

    if (rawField === undefined) {
      errors.push({ field: fieldName, message: 'Missing required field.' })
      continue
    }

    if (typeof rawField !== 'object' || rawField === null) {
      errors.push({ field: fieldName, message: 'Must be a non-null object.' })
      continue
    }

    const f = rawField as Record<string, unknown>
    const fieldErrors = validateFieldShape(fieldName, f)
    errors.push(...fieldErrors)

    if (fieldErrors.length === 0) {
      typedFields[fieldName] = f
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  // Type-specific value validation
  for (const fieldName of AI_EXTRACTION_FIELD_NAMES) {
    if (!(fieldName in typedFields)) continue

    const field = typedFields[fieldName]
    const valueErrors = validateFieldValue(fieldName, field)
    errors.push(...valueErrors)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    extraction: obj as unknown as AiSubscriptionExtraction,
  }
}

function validateFieldShape(
  fieldName: AiExtractionFieldName,
  f: Record<string, unknown>,
): ExtractionValidationError[] {
  const errors: ExtractionValidationError[] = []

  // evidence_type
  if (typeof f.evidence_type !== 'string' || !VALID_EVIDENCE_TYPES.has(f.evidence_type)) {
    errors.push({
      field: fieldName,
      message: `evidence_type must be one of: ${[...VALID_EVIDENCE_TYPES].join(', ')}.`,
    })
  }

  // review_status
  if (typeof f.review_status !== 'string' || !VALID_REVIEW_STATUSES.has(f.review_status)) {
    errors.push({
      field: fieldName,
      message: `review_status must be one of: ${[...VALID_REVIEW_STATUSES].join(', ')}.`,
    })
  }

  // source_text
  if (f.source_text !== null && typeof f.source_text !== 'string') {
    errors.push({ field: fieldName, message: 'source_text must be a string or null.' })
  }

  // is_inferred
  if (typeof f.is_inferred !== 'boolean') {
    errors.push({ field: fieldName, message: 'is_inferred must be a boolean.' })
  }

  // confidence (optional)
  if (f.confidence !== undefined) {
    if (typeof f.confidence !== 'number' || f.confidence < 0 || f.confidence > 1) {
      errors.push({ field: fieldName, message: 'confidence must be a number between 0 and 1.' })
    }
  }

  // Check for unexpected keys
  const allowedKeys = new Set([
    'value', 'evidence_type', 'review_status', 'source_text',
    'is_inferred', 'confidence',
  ])
  for (const key of Object.keys(f)) {
    if (!allowedKeys.has(key)) {
      errors.push({ field: fieldName, message: `Unexpected key "${key}" in field object.` })
    }
  }

  return errors
}

/**
 * Lightweight value-type sanity checks.
 *
 * The validation layer checks for *gross* type mismatches (e.g.,
 * price_amount is a string) but does NOT enforce format constraints
 * like date pattern or enum membership — those are cleaned up
 * by normalization. This keeps the validation boundary crisp:
 *   - validation rejects unparseable / structurally wrong payloads
 *   - normalization cleans up individual field values
 */
function validateFieldValue(
  fieldName: AiExtractionFieldName,
  field: Record<string, unknown>,
): ExtractionValidationError[] {
  const errors: ExtractionValidationError[] = []
  const value = field.value as unknown

  // null is always valid — normalization decides if missing makes sense
  if (value === null) return errors

  switch (fieldName) {
    case 'service_name':
    case 'plan_name':
    case 'category':
    case 'platform':
    case 'cancellation_path':
      if (typeof value !== 'string') {
        errors.push({ field: fieldName, message: 'value must be a string or null.' })
      }
      break

    case 'membership_start_date':
    case 'membership_end_date':
    case 'next_charge_date':
      // Must be string type, but format is normalized downstream
      if (typeof value !== 'string') {
        errors.push({ field: fieldName, message: 'value must be a string or null.' })
      }
      break

    case 'renewal_status':
      // Must be string type, but enum is normalized downstream
      if (typeof value !== 'string') {
        errors.push({ field: fieldName, message: 'value must be a string or null.' })
      }
      break

    case 'price_amount':
      // Must be number type
      if (typeof value !== 'number') {
        errors.push({ field: fieldName, message: 'value must be a number or null.' })
      }
      break

    case 'currency':
      if (typeof value !== 'string') {
        errors.push({ field: fieldName, message: 'value must be a string or null.' })
      }
      break

    case 'billing_period':
      // Must be string type, but enum is normalized downstream
      if (typeof value !== 'string') {
        errors.push({ field: fieldName, message: 'value must be a string or null.' })
      }
      break
  }

  return errors
}

/**
 * Quick check: is this shape plausibly an AI extraction?
 * Does NOT validate field values — use validateAiExtraction for full checking.
 */
export function isAiExtractionShape(raw: unknown): raw is AiSubscriptionExtraction {
  const result = validateAiExtraction(raw)
  return result.ok
}
