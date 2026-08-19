import { afterEach, describe, expect, it, vi } from 'vitest'
import { validateCaptureFile } from '../capture/fileValidation'
import {
  FIXTURE_ASSET_PATH,
  FIXTURE_FILE_SHA256,
  classifyFixtureFile,
  createFixtureCaptureDraft,
} from '../fixtures/membershipFixture'

const FIXED_CAPTURED_AT = '2026-07-15T00:00:00.000Z'

function fixtureFile(): File {
  return new File([new Uint8Array([1, 2, 3, 4])], 'subclear-membership-demo.png', {
    type: 'image/png',
  })
}

function digestBytes(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [])
  return bytes.buffer
}

describe('stable membership fixture', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is a supported de-identified PNG asset and matches by content hash', async () => {
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockResolvedValue(digestBytes(FIXTURE_FILE_SHA256))
    const file = fixtureFile()

    expect(validateCaptureFile(file).status).toBe('valid')
    expect(FIXTURE_ASSET_PATH).toBe('/fixtures/subclear-membership-demo.png')
    await expect(classifyFixtureFile(file)).resolves.toEqual({
      status: 'fixture_match',
      fixture_id: 'aurora_plus_membership_demo',
    })
  })

  it('does not match arbitrary non-fixture files', async () => {
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockResolvedValue(digestBytes('00'.repeat(32)))
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'subclear-membership-demo.png', {
      type: 'image/png',
    })

    await expect(classifyFixtureFile(file)).resolves.toEqual({ status: 'not_fixture' })
  })

  it('creates a deterministic structured draft with all required review states', async () => {
    const file = fixtureFile()
    const draft = createFixtureCaptureDraft({
      file,
      capturedAt: FIXED_CAPTURED_AT,
      sessionId: 'capture_session_test',
    })

    expect(draft.lifecycle_state).toBe('reviewing')
    expect(draft.source.fixture_reference).toBe(FIXTURE_ASSET_PATH)
    expect(draft.review_fields).toHaveLength(7)
    expect(draft.review_fields).toEqual(draft.draft_record?.evidence_records[0].extracted_fields)
    expect(draft.temporary_image).toBeNull()

    expect(
      draft.review_fields.some(
        (field) => field.evidence_type === 'direct' && field.review_status === 'ready',
      ),
    ).toBe(true)
    expect(
      draft.review_fields.some(
        (field) => field.evidence_type === 'inferred' && field.review_status === 'needs_review',
      ),
    ).toBe(true)
    expect(
      draft.review_fields.some(
        (field) => field.evidence_type === 'missing' && field.review_status === 'missing',
      ),
    ).toBe(true)
    expect(
      draft.review_fields.some(
        (field) => field.evidence_type === 'conflict' && field.review_status === 'conflict',
      ),
    ).toBe(true)

    const serviceName = draft.review_fields.find((field) => field.field_name === 'service_name')
    expect(serviceName).toMatchObject({
      extracted_value: 'Aurora Plus',
      evidence_type: 'direct',
      review_status: 'ready',
      user_confirmed: false,
    })
    expect(serviceName).not.toHaveProperty('model_confidence')

    expect(draft.draft_record).toMatchObject({
      service_name: 'Aurora Plus',
      schema_version: 1,
      evidence_records: [
        {
          extraction_method: 'fixture',
          processing_status: 'completed',
          fixture_reference: FIXTURE_ASSET_PATH,
        },
      ],
    })
    expect(JSON.stringify(draft.draft_record)).not.toMatch(/base64|data:image|object_url/i)

    const secondDraft = createFixtureCaptureDraft({
      file,
      capturedAt: FIXED_CAPTURED_AT,
      sessionId: 'capture_session_test',
    })
    expect(secondDraft).toEqual(draft)
  })
})
