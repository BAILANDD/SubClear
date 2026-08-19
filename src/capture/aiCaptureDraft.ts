import type { ExtractionClientSuccess } from '../ai/extractionClient'
import type { CaptureSessionDraft } from '../types/capture'
import type { SubscriptionFacts } from '../types/subscription'
import { CURRENT_SCHEMA_VERSION } from '../types/storage'

interface CreateAiCaptureDraftOptions {
  file: File
  previewUrl: string
  response: ExtractionClientSuccess
  capturedAt: string
  sessionId: string
}

export function createAiCaptureDraft({
  file,
  previewUrl,
  response,
  capturedAt,
  sessionId,
}: CreateAiCaptureDraftOptions): CaptureSessionDraft {
  const evidenceId = `evidence_${sessionId}`
  const draftRecord: SubscriptionFacts = {
    id: `draft_${sessionId}`,
    service_name: '',
    plan_name: null,
    category: null,
    platform: null,
    entitlement_type: 'unknown',
    membership_start_date: null,
    membership_end_date: null,
    renewal_status: 'unknown',
    next_charge_date: null,
    renewal_price: null,
    currency: null,
    billing_cycle: null,
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
        evidence_id: evidenceId,
        source_type: 'unknown',
        file_name: file.name,
        fixture_reference: null,
        extraction_method: 'model',
        processing_status: 'completed',
        created_at: capturedAt,
        extracted_fields: response.data.fields,
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
      source_type: 'unknown',
      file_name: file.name,
      fixture_reference: null,
    },
    temporary_image: {
      kind: 'file',
      file,
      file_name: file.name,
      preview_url: previewUrl,
    },
    draft_record: draftRecord,
    review_fields: response.data.fields,
    ai_extraction: {
      extraction: response.data.extraction,
      issues: response.data.issues,
      meta: response.meta,
    },
  }
}
