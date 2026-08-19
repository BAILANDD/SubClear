import { GoogleGenAI } from '@google/genai'
import { AI_EXTRACTION_JSON_SCHEMA, type AiSubscriptionExtraction } from '../src/ai'
import { buildSubscriptionExtractionPrompt } from './extractionPrompt'
import { toGeminiResponseJsonSchema } from './geminiSchemaAdapter'

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface ExtractionProviderOptions {
  apiKey: string
  model?: string
  timeoutMs?: number
}

export interface ExtractionProviderResult {
  extraction: AiSubscriptionExtraction
  providerRawLatencyMs: number
}

export type ExtractionProviderErrorCode =
  | 'PROVIDER_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'MODEL_OUTPUT_INVALID'

export interface ExtractionProviderError {
  ok: false
  code: ExtractionProviderErrorCode
  message: string
}

export type ExtractionProviderResponse =
  | { ok: true; result: ExtractionProviderResult }
  | ExtractionProviderError

export const GEMINI_EXTRACTION_MODEL = 'gemini-3.5-flash-lite'

// ---------------------------------------------------------------------------
// Provider interface (for future provider swapping)
// ---------------------------------------------------------------------------

export interface SubscriptionExtractionProvider {
  extractFromImage(
    imageBytes: Buffer,
    mimeType: string,
  ): Promise<ExtractionProviderResponse>
}

// ---------------------------------------------------------------------------
// Gemini implementation
// ---------------------------------------------------------------------------

export class GeminiExtractionProvider implements SubscriptionExtractionProvider {
  private readonly model: string
  private readonly timeoutMs: number
  private readonly genai: GoogleGenAI

  constructor(options: ExtractionProviderOptions) {
    this.model = options.model ?? GEMINI_EXTRACTION_MODEL
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.genai = new GoogleGenAI({
      apiKey: options.apiKey,
      httpOptions: { timeout: this.timeoutMs },
    })
  }

  async extractFromImage(
    imageBytes: Buffer,
    mimeType: string,
  ): Promise<ExtractionProviderResponse> {
    const prompt = buildSubscriptionExtractionPrompt()
    const base64Image = imageBytes.toString('base64')
    const geminiSchema = toGeminiResponseJsonSchema(
      AI_EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
    )

    try {
      const start = performance.now()

      const response = await this.genai.models.generateContent({
        model: this.model,
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: geminiSchema,
        },
      })

      const latencyMs = Math.round(performance.now() - start)

      const text = response.text ?? response.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) {
        return {
          ok: false,
          code: 'MODEL_OUTPUT_INVALID',
          message: 'Gemini response had no text content.',
        }
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        return {
          ok: false,
          code: 'MODEL_OUTPUT_INVALID',
          message: 'Failed to parse Gemini response as JSON.',
        }
      }

      const extraction = parsed as AiSubscriptionExtraction

      if (!extraction.schema_version || !extraction.fields) {
        return {
          ok: false,
          code: 'MODEL_OUTPUT_INVALID',
          message: 'Gemini response missing required schema_version or fields.',
        }
      }

      return {
        ok: true,
        result: { extraction, providerRawLatencyMs: latencyMs },
      }
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : String(error)

      const isTimeout =
        (error instanceof DOMException && error.name === 'AbortError') ||
        rawMessage.toLowerCase().includes('timeout') ||
        rawMessage.toLowerCase().includes('aborted')

      if (isTimeout) {
        return {
          ok: false,
          code: 'PROVIDER_TIMEOUT',
          message: `Gemini request timed out after ${this.timeoutMs}ms.`,
        }
      }

      console.error(
        `[SubClear AI] Provider error | ${new Date().toISOString()} | ${summarizeProviderError(rawMessage)}`,
      )

      return {
        ok: false,
        code: 'PROVIDER_ERROR',
        message: 'AI provider request failed.',
      }
    }
  }
}

function summarizeProviderError(message: string): string {
  const maybeJsonStart = message.indexOf('{')
  if (maybeJsonStart >= 0) {
    try {
      const parsed = JSON.parse(message.slice(maybeJsonStart)) as {
        error?: { code?: unknown; status?: unknown; message?: unknown }
      }
      const code = parsed.error?.code
      const status = parsed.error?.status
      const providerMessage = parsed.error?.message
      return [
        code !== undefined ? `code=${String(code)}` : null,
        status !== undefined ? `status=${String(status)}` : null,
        providerMessage !== undefined ? `message=${sanitizeLogDetail(String(providerMessage))}` : null,
      ].filter(Boolean).join(' | ') || 'unparsed provider error'
    } catch {
      // Fall through to string sanitization.
    }
  }

  return sanitizeLogDetail(message)
}

function sanitizeLogDetail(message: string): string {
  return message
    .replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, 300)
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createExtractionProvider(
  apiKey: string,
): SubscriptionExtractionProvider {
  return new GeminiExtractionProvider({
    apiKey,
    model: GEMINI_EXTRACTION_MODEL,
    timeoutMs: 30_000,
  })
}
