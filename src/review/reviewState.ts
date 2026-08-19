import type { CaptureSessionDraft } from '../types/capture'
import type { ExtractedFieldValue, FieldEvidence, SubscriptionFactFieldName } from '../types/evidence'

export interface ReviewFieldTarget {
  evidenceId: string
  fieldName: SubscriptionFactFieldName
}

export interface ConfirmFieldOptions extends ReviewFieldTarget {
  confirmedAt: string
}

export interface EditFieldOptions extends ReviewFieldTarget {
  value: ExtractedFieldValue
}

export type NotApplicableResult =
  | {
      ok: true
      draft: CaptureSessionDraft
    }
  | {
      ok: false
      reason: 'not_supported'
    }

const NOT_APPLICABLE_FIELDS = new Set<SubscriptionFactFieldName>(['renewal_status'])

export function confirmField(
  draft: CaptureSessionDraft,
  options: ConfirmFieldOptions,
): CaptureSessionDraft {
  return updateDraftField(draft, options, (field) => ({
    ...field,
    review_status: 'confirmed',
    user_confirmed: true,
    confirmed_at: options.confirmedAt,
  }))
}

export function editFieldCandidate(
  draft: CaptureSessionDraft,
  options: EditFieldOptions,
): CaptureSessionDraft {
  return updateDraftField(draft, options, (field) => ({
    ...field,
    extracted_value: options.value,
    evidence_type: 'user_edited',
    review_status: 'needs_review',
    is_inferred: false,
    user_confirmed: false,
    confirmed_at: null,
  }))
}

export function clearFieldCandidate(
  draft: CaptureSessionDraft,
  options: ReviewFieldTarget,
): CaptureSessionDraft {
  return updateDraftField(draft, options, (field) => ({
    ...field,
    extracted_value: null,
    evidence_type: 'missing',
    review_status: 'missing',
    is_inferred: false,
    user_confirmed: false,
    confirmed_at: null,
  }))
}

export function setFieldNotApplicable(
  draft: CaptureSessionDraft,
  options: ReviewFieldTarget,
): NotApplicableResult {
  if (!NOT_APPLICABLE_FIELDS.has(options.fieldName)) {
    return {
      ok: false,
      reason: 'not_supported',
    }
  }

  return {
    ok: true,
    draft: editFieldCandidate(draft, {
      ...options,
      value: 'not_applicable',
    }),
  }
}

export function confirmAllReadyFields(
  draft: CaptureSessionDraft,
  confirmedAt: string,
): CaptureSessionDraft {
  return updateDraftFields(draft, (field) => {
    if (field.evidence_type !== 'direct' || field.review_status !== 'ready') {
      return field
    }

    return {
      ...field,
      review_status: 'confirmed',
      user_confirmed: true,
      confirmed_at: confirmedAt,
    }
  })
}

function updateDraftField(
  draft: CaptureSessionDraft,
  target: ReviewFieldTarget,
  update: (field: FieldEvidence) => FieldEvidence,
): CaptureSessionDraft {
  return updateDraftFields(draft, (field, evidenceId) => {
    if (evidenceId !== target.evidenceId || field.field_name !== target.fieldName) {
      return field
    }

    return update(field)
  })
}

function updateDraftFields(
  draft: CaptureSessionDraft,
  update: (field: FieldEvidence, evidenceId: string | null) => FieldEvidence,
): CaptureSessionDraft {
  const evidenceRecords =
    draft.draft_record?.evidence_records.map((record) => ({
      ...record,
      extracted_fields: record.extracted_fields.map((field) => update(field, record.evidence_id)),
    })) ?? []

  const reviewFields =
    evidenceRecords.length > 0
      ? evidenceRecords.flatMap((record) => record.extracted_fields)
      : draft.review_fields.map((field) => update(field, null))

  return {
    ...draft,
    draft_record: draft.draft_record
      ? {
          ...draft.draft_record,
          evidence_records: evidenceRecords,
        }
      : null,
    review_fields: reviewFields,
  }
}
