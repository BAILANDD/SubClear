import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DiscardDraftModal from '../components/DiscardDraftModal'
import PageBackButton from '../components/PageBackButton'
import useAppBack from '../hooks/useAppBack'
import {
  buildSubscriptionRecordFromFormValues,
  mapAiCaptureDraftToSubscriptionFormValues,
  type SubscriptionFormValues,
} from '../subscriptionForm/subscriptionFormCore'
import SubscriptionForm from '../subscriptionForm/subscriptionForm'
import { useSubscriptions } from '../store/useSubscriptions'
import type { CaptureSessionDraft } from '../types/capture'

interface ReviewLocationState {
  draft?: CaptureSessionDraft
}

function getLocationState(value: unknown): ReviewLocationState {
  return typeof value === 'object' && value !== null ? (value as ReviewLocationState) : {}
}

function isCaptureSessionDraft(value: unknown): value is CaptureSessionDraft {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { review_fields?: unknown }).review_fields)
  )
}

export default function ReviewExtractedDetails() {
  const navigate = useNavigate()
  const navigateBack = useAppBack('/scan-screenshot')
  const location = useLocation()
  const { addSubscriptionRecord } = useSubscriptions()
  const locationState = getLocationState(location.state)
  const draft = isCaptureSessionDraft(locationState.draft) ? locationState.draft : null
  const [isDiscardOpen, setIsDiscardOpen] = useState(false)
  const formDraft = useMemo(
    () => (draft ? mapAiCaptureDraftToSubscriptionFormValues(draft) : null),
    [draft],
  )

  function handleSave(values: SubscriptionFormValues): string[] | void {
    if (!draft) return ['当前无法保存。请重新扫描截图。']

    const id = `sub_${crypto.randomUUID()}`
    const record = buildSubscriptionRecordFromFormValues(values, {
      id,
      timestamp: new Date().toISOString(),
      evidenceRecords: draft.draft_record?.evidence_records ?? [],
    })

    if (!addSubscriptionRecord(record)) {
      return ['当前无法保存。记录尚未写入。']
    }

    navigate(`/subscription/${record.facts.id}`)
  }

  if (!draft || !formDraft) {
    return (
      <div className="secondary-page space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">添加订阅</h2>
            <p className="mt-0.5 text-xs text-gray-500">没有可用的截图分析结果。</p>
          </div>
          <PageBackButton fallback="/scan-screenshot" label="返回扫描" />
        </div>
        <div className="space-y-4 rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-600">请返回扫描，或使用手动录入。</p>
          <button
            type="button"
            onClick={() => navigate('/add-trial')}
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700"
          >
            手动录入
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="secondary-page space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">添加订阅</h2>
          <p className="mt-0.5 text-xs text-gray-500">AI 已根据截图预填信息，请确认或修改后保存。</p>
        </div>
        <PageBackButton
          fallback="/scan-screenshot"
          label="返回"
          onBack={() => setIsDiscardOpen(true)}
        />
      </div>

      <SubscriptionForm
        variant="ai"
        initialValues={formDraft.values}
        submitLabel="确认并保存"
        onValidSubmit={handleSave}
        intro="截图信息已填入表单。保存前你可以直接修改任何字段。"
        hints={formDraft.hints}
        showPlanName
        showRecordType
        showMembershipEndDate
      />

      {isDiscardOpen && (
        <DiscardDraftModal
          onContinueReviewing={() => setIsDiscardOpen(false)}
          onDiscardDraft={navigateBack}
          description="这份截图预填草稿只存在于当前添加会话中，离开后将被丢弃。"
          continueLabel="继续编辑"
        />
      )}
    </div>
  )
}
