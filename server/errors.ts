// ---------------------------------------------------------------------------
// Server error contracts
// ---------------------------------------------------------------------------

export const EXTRACTION_ERROR_CODES = [
  'INVALID_REQUEST',
  'UNSUPPORTED_IMAGE_TYPE',
  'IMAGE_TOO_LARGE',
  'AI_NOT_CONFIGURED',
  'PROVIDER_ERROR',
  'PROVIDER_TIMEOUT',
  'MODEL_OUTPUT_INVALID',
  'INTERNAL_ERROR',
] as const

export type ExtractionErrorCode = (typeof EXTRACTION_ERROR_CODES)[number]

export interface ExtractionErrorResponse {
  ok: false
  error: {
    code: ExtractionErrorCode
    message: string
    requestId?: string
  }
}

export function errorResponse(
  code: ExtractionErrorCode,
  message: string,
  requestId?: string,
): ExtractionErrorResponse {
  return {
    ok: false,
    error: { code, message, ...(requestId ? { requestId } : {}) },
  }
}

// ---------------------------------------------------------------------------
// Success contract
// ---------------------------------------------------------------------------

export interface ExtractionSuccessResponse {
  ok: true
  data: {
    extraction: Record<string, unknown>
    fields: Record<string, unknown>[]
    issues: Record<string, unknown>[]
  }
  meta: {
    provider: string
    model: string
    requestId: string
    latencyMs: number
  }
}
