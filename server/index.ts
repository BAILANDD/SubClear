import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import {
  validateAiExtraction,
  processAiExtractionResponseDetailed,
} from '../src/ai'
import {
  createExtractionProvider,
  GEMINI_EXTRACTION_MODEL,
  type ExtractionProviderError,
} from './subscriptionExtractionProvider'
import { errorResponse, type ExtractionSuccessResponse } from './errors'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.SERVER_PORT ?? '3456', 10)
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY
  return key && key.trim().length > 0 ? key.trim() : null
}

function hasAiConfigured(): boolean {
  return getApiKey() !== null
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express()

app.use(cors())
app.use(express.json())

// In-memory multer — no disk persistence
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
})

// ---------------------------------------------------------------------------
// POST /api/extract-subscription
// ---------------------------------------------------------------------------

app.post(
  '/api/extract-subscription',
  upload.single('image'),
  async (req, res): Promise<void> => {
    const requestId = randomUUID()

    // --- Validation ---

    const file = req.file
    if (!file) {
      res.status(400).json(errorResponse('INVALID_REQUEST', 'Missing "image" field in multipart form data.', requestId))
      return
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      res.status(400).json(
        errorResponse(
          'UNSUPPORTED_IMAGE_TYPE',
          `Unsupported image type: ${file.mimetype}. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}.`,
          requestId,
        ),
      )
      return
    }

    if (file.size > MAX_IMAGE_BYTES) {
      res.status(400).json(errorResponse('IMAGE_TOO_LARGE', `Image exceeds ${MAX_IMAGE_BYTES / 1024 / 1024} MB limit.`, requestId))
      return
    }

    if (!hasAiConfigured()) {
      res.status(503).json(
        errorResponse('AI_NOT_CONFIGURED', 'GEMINI_API_KEY is not set. AI extraction is not available.', requestId),
      )
      return
    }

    // --- Provider call ---

    const apiKey = getApiKey()!
    const provider = createExtractionProvider(apiKey)
    const providerResult = await provider.extractFromImage(file.buffer, file.mimetype)

    if (!providerResult.ok) {
      const status =
        providerResult.code === 'MODEL_OUTPUT_INVALID' ? 422
        : providerResult.code === 'PROVIDER_TIMEOUT' ? 504
        : 502

      const clientMessage = clientProviderErrorMessage(providerResult)

      console.error(
        `[${new Date().toISOString()}] ${requestId} | provider=gemini | model=${GEMINI_EXTRACTION_MODEL} | status=failed | code=${providerResult.code}`,
      )

      res.status(status).json(errorResponse(providerResult.code, clientMessage, requestId))
      return
    }

    // --- AI-01 Pipeline ---

    const extraction = providerResult.result.extraction

    const validated = validateAiExtraction(extraction)
    if (!validated.ok) {
      res.status(422).json(
        errorResponse(
          'MODEL_OUTPUT_INVALID',
          `AI extraction failed structural validation: ${validated.errors.map((e) => e.message).join('; ')}`,
          requestId,
        ),
      )
      return
    }

    const processed = processAiExtractionResponseDetailed(validated.extraction)
    if (!processed.ok) {
      res.status(500).json(errorResponse('INTERNAL_ERROR', `AI pipeline processing failed: ${processed.errors.join('; ')}`, requestId))
      return
    }

    // --- Success ---

    const totalLatencyMs = providerResult.result.providerRawLatencyMs

    const response: ExtractionSuccessResponse = {
      ok: true,
      data: {
        extraction: processed.result.extraction as unknown as Record<string, unknown>,
        fields: processed.result.fields.map((f) => ({
          field_name: f.field_name,
          extracted_value: f.extracted_value,
          evidence_type: f.evidence_type,
          review_status: f.review_status,
          source_text: f.source_text,
          is_inferred: f.is_inferred,
          model_confidence: f.model_confidence,
          user_confirmed: f.user_confirmed,
        })),
        issues: processed.result.issues.map((i) => ({
          field: i.field,
          code: i.code,
          message: i.message,
          severity: i.severity,
          ...(i.raw_value !== undefined ? { raw_value: i.raw_value } : {}),
        })),
      },
      meta: {
        provider: 'gemini',
        model: GEMINI_EXTRACTION_MODEL,
        requestId,
        latencyMs: totalLatencyMs,
      },
    }

    // Development log
    console.log(
      `[${new Date().toISOString()}] ${requestId} | provider=gemini | model=${GEMINI_EXTRACTION_MODEL} | latency=${totalLatencyMs}ms | issues=${processed.result.issues.length}`,
    )

    res.json(response)
  },
)

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ai_configured: hasAiConfigured() })
})

// ---------------------------------------------------------------------------
// Start (not during test imports — supertest mounts app directly)
// ---------------------------------------------------------------------------

if (process.env.VITEST !== 'true') {
  app.listen(PORT, () => {
    console.log(`[SubClear AI Server] listening on http://localhost:${PORT}`)
    console.log(`[SubClear AI Server] AI configured: ${hasAiConfigured() ? 'yes' : 'no (set GEMINI_API_KEY to enable)'}`)
  })
}

function clientProviderErrorMessage(providerResult: ExtractionProviderError): string {
  if (providerResult.code === 'PROVIDER_ERROR') {
    return 'AI provider request failed.'
  }

  return providerResult.message
}

export default app
