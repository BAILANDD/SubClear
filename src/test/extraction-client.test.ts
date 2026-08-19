import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  AI_API_BASE_URL,
  extractSubscriptionScreenshot,
} from '../ai/extractionClient'

describe('frontend extraction client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('posts the screenshot as multipart FormData to the SubClear AI backend', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'membership.png', { type: 'image/png' })
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        data: {
          extraction: { schema_version: '1.0', fields: {} },
          fields: [],
          issues: [],
        },
        meta: {
          provider: 'gemini',
          model: 'gemini-3.5-flash-lite',
          requestId: 'req_123',
          latencyMs: 1000,
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await extractSubscriptionScreenshot(file)

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(`${AI_API_BASE_URL}/api/extract-subscription`)
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.body as FormData).get('image')).toBe(file)
  })

  it('returns stable server error contracts without exposing raw provider detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({
        ok: false,
        error: {
          code: 'PROVIDER_TIMEOUT',
          message: 'Gemini stack should stay server-side',
        },
      }),
    }))

    const result = await extractSubscriptionScreenshot(
      new File([new Uint8Array([1])], 'timeout.png', { type: 'image/png' }),
    )

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PROVIDER_TIMEOUT',
        message: 'Gemini stack should stay server-side',
      },
    })
  })

  it('does not include Gemini keys, SDK usage, or direct Google endpoints in frontend AI code', () => {
    const clientSource = readFileSync(resolve(process.cwd(), 'src/ai/extractionClient.ts'), 'utf8')
    const uploadSource = readFileSync(resolve(process.cwd(), 'src/pages/ScreenshotUpload.tsx'), 'utf8')
    const frontendSource = `${clientSource}\n${uploadSource}`

    expect(frontendSource).not.toContain('GEMINI_API_KEY')
    expect(frontendSource).not.toContain('VITE_GEMINI')
    expect(frontendSource).not.toContain('@google/genai')
    expect(frontendSource).not.toContain('generativelanguage.googleapis.com')
    expect(clientSource).toContain('VITE_AI_API_BASE_URL')
    expect(uploadSource).not.toContain('createFixtureCaptureDraft')
    expect(uploadSource).not.toContain('classifyFixtureFile')
  })
})
