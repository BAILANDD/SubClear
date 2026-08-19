import { describe, expect, it, beforeAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import {
  AI_EXTRACTION_SCHEMA_VERSION,
  type AiSubscriptionExtraction,
} from '../ai'

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

const { mockExtractFromImage } = vi.hoisted(() => ({
  mockExtractFromImage: vi.fn(),
}))

vi.mock('../../server/subscriptionExtractionProvider', () => ({
  GEMINI_EXTRACTION_MODEL: 'gemini-3.5-flash-lite',
  createExtractionProvider: () => ({
    extractFromImage: mockExtractFromImage,
  }),
}))

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function validExtraction(): AiSubscriptionExtraction {
  return {
    schema_version: '1.0',
    fields: {
      service_name: {
        value: 'Notion Plus', evidence_type: 'direct', review_status: 'ready',
        source_text: 'Notion Plus', is_inferred: false, confidence: 0.98,
      },
      plan_name: {
        value: 'Plus Monthly', evidence_type: 'direct', review_status: 'ready',
        source_text: 'Plan: Plus', is_inferred: false, confidence: 0.97,
      },
      category: {
        value: 'Productivity', evidence_type: 'inferred', review_status: 'needs_review',
        source_text: 'Productivity', is_inferred: true, confidence: 0.65,
      },
      platform: {
        value: 'Notion 官网', evidence_type: 'direct', review_status: 'ready',
        source_text: 'notion.so', is_inferred: false, confidence: 0.92,
      },
      membership_start_date: {
        value: '2026-01-15', evidence_type: 'direct', review_status: 'ready',
        source_text: 'Member since 2026', is_inferred: false, confidence: 0.95,
      },
      membership_end_date: {
        value: null, evidence_type: 'missing', review_status: 'missing',
        source_text: null, is_inferred: false,
      },
      renewal_status: {
        value: 'auto_renew_on', evidence_type: 'inferred', review_status: 'needs_review',
        source_text: 'Renews automatically', is_inferred: true, confidence: 0.82,
      },
      next_charge_date: {
        value: '2026-09-01', evidence_type: 'direct', review_status: 'ready',
        source_text: 'Next charge Sep 1', is_inferred: false, confidence: 0.96,
      },
      price_amount: {
        value: 10, evidence_type: 'direct', review_status: 'ready',
        source_text: '$10/month', is_inferred: false, confidence: 0.99,
      },
      currency: {
        value: 'USD', evidence_type: 'direct', review_status: 'ready',
        source_text: '$', is_inferred: false, confidence: 0.99,
      },
      billing_period: {
        value: 'monthly', evidence_type: 'direct', review_status: 'ready',
        source_text: '/month', is_inferred: false, confidence: 0.97,
      },
      cancellation_path: {
        value: null, evidence_type: 'missing', review_status: 'missing',
        source_text: null, is_inferred: false,
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Import app (mock is hoisted, so it applies before this import)
// ---------------------------------------------------------------------------

import app from '../../server/index'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AI Server — Health & Configuration', () => {
  it('starts with ai_configured matching env', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('ok', true)
    expect(res.body).toHaveProperty('ai_configured')
  })
})

describe('AI Server — Request Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure mock returns "no key" state for validation tests
    process.env.GEMINI_API_KEY = ''
  })

  it('INVALID_REQUEST — no image field', async () => {
    const res = await request(app)
      .post('/api/extract-subscription')
      .field('not-image', 'value')

    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error.code).toBe('INVALID_REQUEST')
  })

  it('UNSUPPORTED_IMAGE_TYPE — wrong MIME', async () => {
    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('fake-gif'), { filename: 'test.gif', contentType: 'image/gif' })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('UNSUPPORTED_IMAGE_TYPE')
  })

  it('AI_NOT_CONFIGURED — no API key set', async () => {
    process.env.GEMINI_API_KEY = ''
    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('fake-png'), { filename: 'test.png', contentType: 'image/png' })

    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED')
  })
})

describe('AI Server — Provider Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  it('success — provider valid response produces ProcessedAiExtraction', async () => {
    mockExtractFromImage.mockResolvedValueOnce({
      ok: true,
      result: {
        extraction: validExtraction(),
        providerRawLatencyMs: 500,
      },
    })

    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('fake-png-data'), { filename: 'screenshot.png', contentType: 'image/png' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('extraction')
    expect(res.body.data).toHaveProperty('fields')
    expect(res.body.data).toHaveProperty('issues')
    expect(res.body.meta.provider).toBe('gemini')
    expect(res.body.meta.model).toBe('gemini-3.5-flash-lite')
  })

  it('MODEL_OUTPUT_INVALID — provider returns error', async () => {
    mockExtractFromImage.mockResolvedValueOnce({
      ok: false,
      code: 'MODEL_OUTPUT_INVALID',
      message: 'Gemini returned an empty response.',
    })

    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('bad'), { filename: 'bad.png', contentType: 'image/png' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('MODEL_OUTPUT_INVALID')
  })

  it('PROVIDER_ERROR — provider throws', async () => {
    mockExtractFromImage.mockResolvedValueOnce({
      ok: false,
      code: 'PROVIDER_ERROR',
      message: 'Gemini provider error: Network failure',
    })

    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('error-trigger'), { filename: 'error.png', contentType: 'image/png' })

    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('PROVIDER_ERROR')
  })

  it('PROVIDER_TIMEOUT — provider timeout returns stable error', async () => {
    mockExtractFromImage.mockResolvedValueOnce({
      ok: false,
      code: 'PROVIDER_TIMEOUT',
      message: 'Gemini request timed out after 30000ms.',
    })

    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('timeout-trigger'), { filename: 'timeout.png', contentType: 'image/png' })

    expect(res.status).toBe(504)
    expect(res.body.error.code).toBe('PROVIDER_TIMEOUT')
    expect(res.body.error.message).toContain('timed out')
    // No stack trace or API key in error
    const bodyStr = JSON.stringify(res.body)
    expect(bodyStr).not.toContain('stack')
    expect(bodyStr).not.toContain('test-key')
  })

  it('success — invalid date produces success with issues', async () => {
    const extraction = validExtraction()
    ;(extraction.fields.membership_start_date.value as unknown) = '15/08/2026'
    extraction.fields.membership_start_date.evidence_type = 'direct'

    mockExtractFromImage.mockResolvedValueOnce({
      ok: true,
      result: { extraction, providerRawLatencyMs: 400 },
    })

    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('data'), { filename: 'test.png', contentType: 'image/png' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const dateIssues = res.body.data.issues.filter(
      (i: Record<string, unknown>) => i.code === 'invalid_date',
    )
    expect(dateIssues.length).toBeGreaterThanOrEqual(1)
  })

  it('success — semantic conflict produces issues in response', async () => {
    const extraction = validExtraction()
    extraction.fields.renewal_status.value = 'auto_renew_off'
    extraction.fields.next_charge_date.value = '2026-09-01'
    extraction.fields.next_charge_date.review_status = 'ready'

    mockExtractFromImage.mockResolvedValueOnce({
      ok: true,
      result: { extraction, providerRawLatencyMs: 300 },
    })

    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('data'), { filename: 'test.png', contentType: 'image/png' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const conflicts = res.body.data.issues.filter(
      (i: Record<string, unknown>) => i.code === 'renewal_charge_conflict',
    )
    expect(conflicts.length).toBeGreaterThanOrEqual(1)
  })

  it('API key never appears in response', async () => {
    mockExtractFromImage.mockResolvedValueOnce({
      ok: true,
      result: { extraction: validExtraction(), providerRawLatencyMs: 200 },
    })

    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('data'), { filename: 'test.png', contentType: 'image/png' })

    const bodyStr = JSON.stringify(res.body)
    expect(bodyStr).not.toContain('test-key')
    expect(bodyStr).not.toContain('GEMINI_API_KEY')
  })

  it('endpoint does not create SubscriptionRecord', async () => {
    mockExtractFromImage.mockResolvedValueOnce({
      ok: true,
      result: { extraction: validExtraction(), providerRawLatencyMs: 200 },
    })

    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('data'), { filename: 'test.png', contentType: 'image/png' })

    expect(res.body).not.toHaveProperty('record')
    expect(res.body.data).not.toHaveProperty('record')
  })

  it('response includes requestId', async () => {
    mockExtractFromImage.mockResolvedValueOnce({
      ok: true,
      result: { extraction: validExtraction(), providerRawLatencyMs: 200 },
    })

    const res = await request(app)
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('data'), { filename: 'test.png', contentType: 'image/png' })

    expect(res.body.meta.requestId).toBeDefined()
    expect(typeof res.body.meta.requestId).toBe('string')
  })
})

// =========================================================================
// Unit: Prompt
// =========================================================================

describe('AI Server — Extraction Prompt', () => {
  it('contains core extraction rules', async () => {
    const { buildSubscriptionExtractionPrompt } = await import('../../server/extractionPrompt')
    const prompt = buildSubscriptionExtractionPrompt()

    expect(prompt).toContain('YYYY-MM-DD')
    expect(prompt).toContain('auto_renew_on')
    expect(prompt).toContain('direct')
    expect(prompt).toContain('inferred')
    expect(prompt).toContain('needs_review')
    expect(prompt).toContain('user_edited')
    expect(prompt).toContain('confirmed')
  })
})

// =========================================================================
// Unit: Errors
// =========================================================================

describe('AI Server — Error Contracts', () => {
  it('errorResponse produces stable format', async () => {
    const { errorResponse } = await import('../../server/errors')
    const err = errorResponse('AI_NOT_CONFIGURED', 'No key set', 'req-123')

    expect(err.ok).toBe(false)
    expect(err.error.code).toBe('AI_NOT_CONFIGURED')
    expect(err.error.message).toBe('No key set')
    expect(err.error.requestId).toBe('req-123')
  })

  it('all error codes are covered', async () => {
    const { EXTRACTION_ERROR_CODES } = await import('../../server/errors')
    expect(EXTRACTION_ERROR_CODES).toContain('INVALID_REQUEST')
    expect(EXTRACTION_ERROR_CODES).toContain('UNSUPPORTED_IMAGE_TYPE')
    expect(EXTRACTION_ERROR_CODES).toContain('IMAGE_TOO_LARGE')
    expect(EXTRACTION_ERROR_CODES).toContain('AI_NOT_CONFIGURED')
    expect(EXTRACTION_ERROR_CODES).toContain('PROVIDER_ERROR')
    expect(EXTRACTION_ERROR_CODES).toContain('MODEL_OUTPUT_INVALID')
    expect(EXTRACTION_ERROR_CODES).toContain('INTERNAL_ERROR')
  })
})

// =========================================================================
// Regression
// =========================================================================

describe('AI Server — Regression', () => {
  it('existing AI-01 fixture is not changed', async () => {
    const { createFixtureCaptureDraft } = await import('../fixtures/membershipFixture')
    const draft = createFixtureCaptureDraft({
      file: new File([new Uint8Array([1])], 'subclear-membership-demo.png', { type: 'image/png' }),
      capturedAt: '2026-08-01T00:00:00.000Z',
      sessionId: 'regression_test',
    })

    expect(draft.review_fields).toHaveLength(7)
    expect(draft.review_fields[0].field_name).toBe('service_name')
  })

  it('AI_EXTRACTION_SCHEMA_VERSION is still "1.0"', () => {
    expect(AI_EXTRACTION_SCHEMA_VERSION).toBe('1.0')
  })
})

// =========================================================================
// Gemini Schema Adapter
// =========================================================================

describe('AI Server — Gemini Schema Adapter', () => {
  it('converts const "1.0" to enum ["1.0"]', async () => {
    const { toGeminiResponseJsonSchema } = await import('../../server/geminiSchemaAdapter')
    const input = {
      type: 'object',
      properties: {
        schema_version: { type: 'string', const: '1.0' },
      },
      required: ['schema_version'],
    }
    const output = toGeminiResponseJsonSchema(input) as Record<string, unknown>

    const sv = (output.properties as Record<string, unknown>).schema_version as Record<string, unknown>
    expect(sv).not.toHaveProperty('const')
    expect(sv).toHaveProperty('enum')
    expect(sv.enum).toEqual(['1.0'])
  })

  it('output contains no const keyword anywhere', async () => {
    const { toGeminiResponseJsonSchema } = await import('../../server/geminiSchemaAdapter')
    const { AI_EXTRACTION_JSON_SCHEMA } = await import('../ai')
    const output = toGeminiResponseJsonSchema(
      AI_EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
    )
    const json = JSON.stringify(output)
    expect(json).not.toContain('"const"')
  })

  it('does not modify the original AI_EXTRACTION_JSON_SCHEMA', async () => {
    const { toGeminiResponseJsonSchema } = await import('../../server/geminiSchemaAdapter')
    const { AI_EXTRACTION_JSON_SCHEMA } = await import('../ai')
    const before = JSON.stringify(AI_EXTRACTION_JSON_SCHEMA)
    toGeminiResponseJsonSchema(
      AI_EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
    )
    const after = JSON.stringify(AI_EXTRACTION_JSON_SCHEMA)
    expect(after).toBe(before)
  })

  it('preserves: required, properties, enum, additionalProperties, minimum, maximum', async () => {
    const { toGeminiResponseJsonSchema } = await import('../../server/geminiSchemaAdapter')
    const { AI_EXTRACTION_JSON_SCHEMA } = await import('../ai')
    const output = toGeminiResponseJsonSchema(
      AI_EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
    )
    const json = JSON.stringify(output)
    expect(json).toContain('"required"')
    expect(json).toContain('"properties"')
    expect(json).toContain('"enum"')
    expect(json).toContain('"additionalProperties"')
    expect(json).toContain('"minimum"')
    expect(json).toContain('"maximum"')
  })

  it('Gemini schema_version is still restricted to "1.0" (via enum)', async () => {
    const { toGeminiResponseJsonSchema } = await import('../../server/geminiSchemaAdapter')
    const { AI_EXTRACTION_JSON_SCHEMA } = await import('../ai')
    const output = toGeminiResponseJsonSchema(
      AI_EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
    )
    const props = (output as Record<string, unknown>).properties as Record<string, unknown>
    const sv = props.schema_version as Record<string, unknown>
    expect(sv.enum).toEqual(['1.0'])
  })
})

// =========================================================================
// Provider Error Sanitization
// =========================================================================

describe('AI Server — Provider Error Sanitization', () => {
  let app: unknown

  beforeAll(async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    const { default: appModule } = await import('../../server/index')
    app = appModule
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PROVIDER_ERROR does not leak full Google raw payload', async () => {
    const sensitivePayload = JSON.stringify({
      error: {
        code: 400,
        message: 'Invalid JSON payload received.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: 'response_schema', description: 'Unknown name "const"' }] }],
      },
    })

    mockExtractFromImage.mockResolvedValueOnce({
      ok: false,
      code: 'PROVIDER_ERROR',
      message: sensitivePayload,
    })

    const res = await request(app as Parameters<typeof request>[0])
      .post('/api/extract-subscription')
      .attach('image', Buffer.from('data'), { filename: 'test.png', contentType: 'image/png' })

    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('PROVIDER_ERROR')
    const bodyStr = JSON.stringify(res.body)
    // Should not contain raw Google error internals after truncation
    expect(bodyStr).not.toContain('fieldViolations')
    expect(bodyStr).not.toContain('type.googleapis.com')
    expect(res.body.error.message).toBe('AI provider request failed.')
  })
})
