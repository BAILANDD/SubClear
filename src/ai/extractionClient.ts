import type {
  AiExtractionIssue,
  AiSubscriptionExtraction,
} from './extractionTypes'
import type { FieldEvidence } from '../types/evidence'

export const AI_API_BASE_URL = (
  import.meta.env.VITE_AI_API_BASE_URL ?? 'http://localhost:3456'
).replace(/\/$/, '')

export type ExtractionErrorCode =
  | 'INVALID_REQUEST'
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'IMAGE_TOO_LARGE'
  | 'AI_NOT_CONFIGURED'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'MODEL_OUTPUT_INVALID'
  | 'INTERNAL_ERROR'

export interface ExtractionClientSuccess {
  ok: true
  data: {
    extraction: AiSubscriptionExtraction
    fields: FieldEvidence[]
    issues: AiExtractionIssue[]
  }
  meta: {
    provider: string
    model: string
    requestId: string
    latencyMs: number
  }
}

export interface ExtractionClientFailure {
  ok: false
  error: {
    code: ExtractionErrorCode
    message: string
  }
}

export type ExtractionClientResult = ExtractionClientSuccess | ExtractionClientFailure

export async function extractSubscriptionScreenshot(
  file: File,
): Promise<ExtractionClientResult> {
  const formData = new FormData()
  formData.append('image', file)

  let response: Response
  try {
    response = await fetch(`${AI_API_BASE_URL}/api/extract-subscription`, {
      method: 'POST',
      body: formData,
    })
  } catch {
    return extractionFailure('PROVIDER_ERROR', 'AI provider request failed.')
  }

  const payload = await parseJson(response)
  if (!isRecord(payload)) {
    return extractionFailure('INTERNAL_ERROR', 'Invalid extraction response.')
  }

  if (payload.ok === true) {
    if (!isExtractionSuccess(payload)) {
      return extractionFailure('INTERNAL_ERROR', 'Invalid extraction response.')
    }
    return payload as unknown as ExtractionClientSuccess
  }

  const error = isRecord(payload.error) ? payload.error : {}
  return extractionFailure(
    isExtractionErrorCode(error.code) ? error.code : 'INTERNAL_ERROR',
    typeof error.message === 'string' ? error.message : 'AI analysis failed.',
  )
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function extractionFailure(
  code: ExtractionErrorCode,
  message: string,
): ExtractionClientFailure {
  return {
    ok: false,
    error: { code, message },
  }
}

function isExtractionSuccess(value: Record<string, unknown>): boolean {
  const data = value.data
  const meta = value.meta
  return (
    isRecord(data) &&
    isRecord(data.extraction) &&
    Array.isArray(data.fields) &&
    Array.isArray(data.issues) &&
    isRecord(meta) &&
    typeof meta.provider === 'string' &&
    typeof meta.model === 'string' &&
    typeof meta.requestId === 'string' &&
    typeof meta.latencyMs === 'number'
  )
}

function isExtractionErrorCode(value: unknown): value is ExtractionErrorCode {
  return (
    value === 'INVALID_REQUEST' ||
    value === 'UNSUPPORTED_IMAGE_TYPE' ||
    value === 'IMAGE_TOO_LARGE' ||
    value === 'AI_NOT_CONFIGURED' ||
    value === 'PROVIDER_ERROR' ||
    value === 'PROVIDER_TIMEOUT' ||
    value === 'MODEL_OUTPUT_INVALID' ||
    value === 'INTERNAL_ERROR'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
