import { CURRENT_SCHEMA_VERSION } from '../types/storage'
import type { CaptureSessionDraft } from '../types/capture'
import type { FieldEvidence } from '../types/evidence'
import type { SubscriptionFacts } from '../types/subscription'

export const FIXTURE_ASSET_PATH = '/fixtures/subclear-membership-demo.png'
export const FIXTURE_ID = 'aurora_plus_membership_demo'
export const FIXTURE_FILE_SHA256 =
  '7a21e60cb8257a5702c87f72fd8822a914239521be12c3480c87f5748a01e847'

export type FixtureClassificationResult =
  | {
      status: 'fixture_match'
      fixture_id: typeof FIXTURE_ID
    }
  | {
      status: 'not_fixture'
    }

export interface FixtureDraftOptions {
  file: File
  capturedAt: string
  sessionId: string
}

export async function classifyFixtureFile(file: File): Promise<FixtureClassificationResult> {
  if (file.type !== 'image/png') {
    return { status: 'not_fixture' }
  }

  const hash = await sha256(file)
  if (hash !== FIXTURE_FILE_SHA256) {
    return { status: 'not_fixture' }
  }

  return {
    status: 'fixture_match',
    fixture_id: FIXTURE_ID,
  }
}

export function createFixtureCaptureDraft({
  file,
  capturedAt,
  sessionId,
}: FixtureDraftOptions): CaptureSessionDraft {
  const reviewFields = createFixtureFields()
  const draftRecord: SubscriptionFacts = {
    id: `draft_${sessionId}`,
    service_name: 'Aurora Plus',
    plan_name: 'Premium Monthly',
    category: null,
    platform: null,
    entitlement_type: 'paid_membership',
    membership_start_date: null,
    membership_end_date: '2026-08-30',
    renewal_status: 'auto_renew_on',
    next_charge_date: '2026-08-30',
    renewal_price: null,
    currency: 'CNY',
    billing_cycle: 'monthly',
    cancellation_status: 'none',
    cancellation_path: null,
    cancellation_steps: [],
    cancellation_deadline: null,
    planned_cancel_date: null,
    cancellation_completed_at: null,
    cancellation_proof: null,
    reminder_settings: {
      enabled: true,
      offset_days: 7,
      state: 'enabled',
    },
    evidence_records: [
      {
        evidence_id: `evidence_${sessionId}`,
        source_type: 'in_app_membership',
        file_name: file.name,
        fixture_reference: FIXTURE_ASSET_PATH,
        extraction_method: 'fixture',
        processing_status: 'completed',
        created_at: capturedAt,
        extracted_fields: reviewFields,
      },
    ],
    schema_version: CURRENT_SCHEMA_VERSION,
    created_at: capturedAt,
    updated_at: capturedAt,
  }

  return {
    session_id: sessionId,
    lifecycle_state: 'reviewing',
    source: {
      source_type: 'in_app_membership',
      file_name: file.name,
      fixture_reference: FIXTURE_ASSET_PATH,
    },
    temporary_image: null,
    draft_record: draftRecord,
    review_fields: reviewFields,
  }
}

function createFixtureFields(): FieldEvidence[] {
  return [
    {
      field_name: 'service_name',
      extracted_value: 'Aurora Plus',
      source_text: 'Aurora Plus',
      evidence_type: 'direct',
      review_status: 'ready',
      is_inferred: false,
      user_confirmed: false,
      confirmed_at: null,
    },
    {
      field_name: 'plan_name',
      extracted_value: 'Premium Monthly',
      source_text: 'Premium Monthly',
      evidence_type: 'direct',
      review_status: 'ready',
      is_inferred: false,
      user_confirmed: false,
      confirmed_at: null,
    },
    {
      field_name: 'membership_end_date',
      extracted_value: '2026-08-30',
      source_text: 'Membership valid until Aug 30, 2026',
      evidence_type: 'direct',
      review_status: 'ready',
      is_inferred: false,
      user_confirmed: false,
      confirmed_at: null,
    },
    {
      field_name: 'renewal_status',
      extracted_value: 'auto_renew_on',
      source_text: 'Renews automatically unless cancelled',
      evidence_type: 'inferred',
      review_status: 'needs_review',
      is_inferred: true,
      user_confirmed: false,
      confirmed_at: null,
    },
    {
      field_name: 'next_charge_date',
      extracted_value: '2026-08-30',
      source_text: 'Next charge 2026-08-30',
      evidence_type: 'direct',
      review_status: 'ready',
      is_inferred: false,
      user_confirmed: false,
      confirmed_at: null,
    },
    {
      field_name: 'renewal_price',
      extracted_value: {
        candidates: ['28', '30'],
        currency: 'CNY',
      },
      source_text: 'Plan page says ¥28 / month. Receipt area shows ¥30 / month.',
      evidence_type: 'conflict',
      review_status: 'conflict',
      is_inferred: false,
      user_confirmed: false,
      confirmed_at: null,
    },
    {
      field_name: 'cancellation_path',
      extracted_value: null,
      source_text: 'Detailed cancellation path not shown',
      evidence_type: 'missing',
      review_status: 'missing',
      is_inferred: false,
      user_confirmed: false,
      confirmed_at: null,
    },
  ]
}

async function sha256(file: File): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
