import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { generateContentMock, googleGenAIConstructorMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  googleGenAIConstructorMock: vi.fn(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock(options) {
    googleGenAIConstructorMock(options)
    return {
      models: {
        generateContent: generateContentMock,
      },
    }
  }),
}))

describe('GeminiExtractionProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('uses @google/genai with responseJsonSchema and the frozen Gemini model', async () => {
    vi.stubGlobal('fetch', vi.fn())
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        schema_version: '1.0',
        fields: {},
      }),
    })

    const { GeminiExtractionProvider } = await import('../../server/subscriptionExtractionProvider')
    const provider = new GeminiExtractionProvider({ apiKey: 'test-key' })

    await provider.extractFromImage(Buffer.from('image-bytes'), 'image/png')

    expect(googleGenAIConstructorMock).toHaveBeenCalledWith({
      apiKey: 'test-key',
      httpOptions: { timeout: 30_000 },
    })
    expect(generateContentMock).toHaveBeenCalledTimes(1)

    const request = generateContentMock.mock.calls[0][0]
    expect(request.model).toBe('gemini-3.5-flash-lite')
    expect(request.config.responseMimeType).toBe('application/json')
    expect(request.config.responseJsonSchema).toBeDefined()
    expect(request.config.responseSchema).toBeUndefined()
    expect(JSON.stringify(request.config.responseJsonSchema)).not.toContain('"const"')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('returns PROVIDER_TIMEOUT when the SDK request times out', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('Request timeout exceeded'))

    const { GeminiExtractionProvider } = await import('../../server/subscriptionExtractionProvider')
    const provider = new GeminiExtractionProvider({ apiKey: 'test-key', timeoutMs: 30_000 })

    const result = await provider.extractFromImage(Buffer.from('image-bytes'), 'image/png')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('PROVIDER_TIMEOUT')
      expect(result.message).toBe('Gemini request timed out after 30000ms.')
    }
  })

  it('does not expose raw provider errors or API keys to callers', async () => {
    generateContentMock.mockRejectedValueOnce(new Error(JSON.stringify({
      error: {
        code: 400,
        message: 'Invalid JSON payload received.',
        details: [{
          '@type': 'type.googleapis.com/google.rpc.BadRequest',
          fieldViolations: [{ field: 'generation_config.response_schema', description: 'Unknown name "const"' }],
        }],
      },
      apiKey: 'test-key',
    })))

    const { GeminiExtractionProvider } = await import('../../server/subscriptionExtractionProvider')
    const provider = new GeminiExtractionProvider({ apiKey: 'test-key' })

    const result = await provider.extractFromImage(Buffer.from('image-bytes'), 'image/png')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('PROVIDER_ERROR')
      expect(result.message).toBe('AI provider request failed.')
      expect(result.message).not.toContain('fieldViolations')
      expect(result.message).not.toContain('test-key')
    }
  })

  it('does not contain the exploratory raw Gemini REST provider or alternate model', () => {
    const providerSource = readFileSync(
      resolve(process.cwd(), 'server/subscriptionExtractionProvider.ts'),
      'utf8',
    )
    const serverSource = readFileSync(resolve(process.cwd(), 'server/index.ts'), 'utf8')

    expect(providerSource).not.toContain('generativelanguage.googleapis.com')
    expect(providerSource).not.toContain('gemini-flash-latest')
    expect(providerSource).not.toContain('response_schema')
    expect(serverSource).not.toContain('gemini-flash-latest')
  })
})
