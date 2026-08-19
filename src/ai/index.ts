export type {
  AiExtractionField,
  AiExtractionFieldName,
  AiExtractionIssue,
  AiExtractionIssueCode,
  AiExtractionIssueSeverity,
  AiSubscriptionExtraction,
  ProcessedAiExtraction,
} from './extractionTypes'

export {
  AI_EXTRACTION_FIELD_NAMES,
  AI_EXTRACTION_ISSUE_CODES,
  AI_EXTRACTION_SCHEMA_VERSION,
  AI_TO_CANONICAL_FIELD,
} from './extractionTypes'

export {
  AI_EXTRACTION_JSON_SCHEMA,
  isAiExtractionShape,
  validateAiExtraction,
  type ExtractionValidationError,
  type ExtractionValidationResult,
} from './extractionSchema'

export {
  checkExtractionConsistency,
  normalizeAiExtractionFields,
  processAiExtractionResponse,
  processAiExtractionResponseDetailed,
  processValidatedExtraction,
  type NormalizeExtractionResult,
  type ProcessedExtractionResult,
} from './normalizeExtraction'
