import type { EvidenceSourceType, FieldEvidence } from './evidence'
import type {
  AiExtractionIssue,
  AiSubscriptionExtraction,
} from '../ai/extractionTypes'
import type { SubscriptionFacts } from './subscription'

export type CaptureSessionLifecycleState =
  | 'empty'
  | 'image_selected'
  | 'analyzing'
  | 'reviewing'
  | 'failed'
  | 'discarded'

export type TemporaryImageReference =
  | {
      kind: 'file'
      file: File
      file_name: string
      preview_url?: string
    }
  | {
      kind: 'object_url'
      object_url: string
      file_name?: string
    }

export interface CaptureSourceMetadata {
  source_type: EvidenceSourceType
  file_name?: string | null
  fixture_reference?: string | null
}

export interface CaptureSessionDraft {
  session_id: string
  lifecycle_state: CaptureSessionLifecycleState
  source: CaptureSourceMetadata
  temporary_image: TemporaryImageReference | null
  draft_record: SubscriptionFacts | null
  review_fields: FieldEvidence[]
  ai_extraction?: {
    extraction: AiSubscriptionExtraction
    issues: AiExtractionIssue[]
    meta?: {
      provider: string
      model: string
      requestId: string
      latencyMs: number
    }
  }
}
