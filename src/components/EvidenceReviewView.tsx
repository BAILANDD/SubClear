import { useState } from 'react'
import { isFieldEvidenceUnresolved } from '../selectors/subscriptions'
import type { ExtractedFieldValue, FieldEvidence, SubscriptionFactFieldName, SubscriptionRecord } from '../types'
import { formatDate } from '../utils/date'

interface EvidenceReviewViewProps {
  record: SubscriptionRecord
  onApplyCandidate: (
    evidenceId: string,
    fieldName: SubscriptionFactFieldName,
    value: ExtractedFieldValue,
  ) => boolean
  onClearCandidate: (evidenceId: string, fieldName: SubscriptionFactFieldName) => boolean
  onConfirmField: (evidenceId: string, fieldName: SubscriptionFactFieldName) => boolean
}

const FIELD_LABELS: Partial<Record<SubscriptionFactFieldName, string>> = {
  service_name: '服务名称',
  plan_name: '套餐名称',
  category: '分类',
  platform: '平台',
  entitlement_type: '权益类型',
  membership_start_date: '会员开始日期',
  membership_end_date: '会员结束日期',
  renewal_status: '续费状态',
  next_charge_date: '下次扣费日期',
  renewal_price: '续费价格',
  currency: '币种',
  billing_cycle: '计费周期',
  cancellation_status: '取消状态',
  cancellation_path: '取消路径',
  cancellation_steps: '取消步骤',
  cancellation_deadline: '取消截止日期',
  planned_cancel_date: '计划取消日期',
  cancellation_completed_at: '取消完成时间',
  cancellation_proof: '取消凭证',
}

const RENEWAL_STATUS_OPTIONS = [
  'auto_renew_on',
  'auto_renew_off',
  'manual_renewal',
  'not_applicable',
  'unknown',
]

const CANCELLATION_STATUS_OPTIONS = ['none', 'planned', 'in_progress', 'confirmed']

export default function EvidenceReviewView({
  record,
  onApplyCandidate,
  onClearCandidate,
  onConfirmField,
}: EvidenceReviewViewProps) {
  if (record.facts.evidence_records.length === 0) {
    return <p className="text-xs text-gray-500">没有已捕获证据。</p>
  }

  return (
    <div data-testid="evidence-review-view" className="space-y-3">
      {record.facts.evidence_records.map((evidenceRecord, index) => (
        <section
          key={evidenceRecord.evidence_id}
          className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5"
        >
          <div className="space-y-1 rounded-lg bg-white px-3 py-2 text-[11px] text-gray-500">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="font-semibold text-gray-800">证据来源 {index + 1}</p>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                {formatSourceSummary(evidenceRecord.extracted_fields)}
              </span>
            </div>
            <p className="break-words">
              {formatToken(evidenceRecord.source_type)} · {evidenceRecord.file_name ?? evidenceRecord.fixture_reference ?? '没有文件引用'} ·{' '}
              {formatToken(evidenceRecord.extraction_method)}
            </p>
            <p>创建于 {formatDate(evidenceRecord.created_at.split('T')[0])}</p>
          </div>
          {evidenceRecord.extracted_fields.map((field) => (
            <EvidenceFieldReviewCard
              key={`${evidenceRecord.evidence_id}-${field.field_name}`}
              evidenceId={evidenceRecord.evidence_id}
              field={field}
              currentValue={getCurrentFactValue(record, field.field_name)}
              onApplyCandidate={onApplyCandidate}
              onClearCandidate={onClearCandidate}
              onConfirmField={onConfirmField}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function EvidenceFieldReviewCard({
  evidenceId,
  field,
  currentValue,
  onApplyCandidate,
  onClearCandidate,
  onConfirmField,
}: {
  evidenceId: string
  field: FieldEvidence
  currentValue: ExtractedFieldValue
  onApplyCandidate: EvidenceReviewViewProps['onApplyCandidate']
  onClearCandidate: EvidenceReviewViewProps['onClearCandidate']
  onConfirmField: EvidenceReviewViewProps['onConfirmField']
}) {
  const label = FIELD_LABELS[field.field_name] ?? formatToken(field.field_name)
  const [isEditing, setIsEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(toEditableValue(field.extracted_value, field.field_name))
  const [isSourceExpanded, setIsSourceExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isResolved = field.review_status === 'confirmed' && field.user_confirmed
  const stateLabel = getReviewStateLabel(field)
  const sourcePreview = getSourcePreview(field.source_text)
  const canExpandSource = Boolean(field.source_text && sourcePreview !== field.source_text)

  function startEditing() {
    setDraftValue(toEditableValue(field.extracted_value, field.field_name))
    setError(null)
    setIsEditing(true)
  }

  function applyEdit() {
    const applied = onApplyCandidate(evidenceId, field.field_name, parseEditableValue(field.field_name, draftValue))
    if (!applied) {
      setError('无法保存这个候选值，请重试。')
      return
    }
    setIsEditing(false)
  }

  function confirm() {
    setError(null)
    if (!onConfirmField(evidenceId, field.field_name)) {
      setError('无法确认这个字段，请检查后重试。')
    }
  }

  function clear() {
    setError(null)
    if (!onClearCandidate(evidenceId, field.field_name)) {
      setError('无法清空这个候选值，请重试。')
    }
  }

  return (
    <article
      data-testid={`evidence-field-${field.field_name}`}
      className={`space-y-2 rounded-lg border bg-white p-3 ${
        isResolved ? 'border-green-100' : 'border-amber-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
          <p className={`mt-1 text-xs font-semibold ${isResolved ? 'text-green-700' : 'text-amber-700'}`}>
            {stateLabel}
          </p>
        </div>
        <div className="max-w-full text-left text-[11px] font-medium text-gray-500 sm:text-right">
          <p>证据类型：{formatEvidenceType(field.evidence_type)}</p>
          <p>核对状态：{formatReviewStatus(field.review_status)}</p>
          <p>用户确认：{field.user_confirmed ? '是' : '否'}</p>
        </div>
      </div>

      <div className="grid gap-2 text-xs text-gray-500 sm:grid-cols-2">
        <ValueBlock label="当前已保存值" value={currentValue} />
        <ValueBlock label="候选变更" value={field.extracted_value} />
      </div>

      <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-gray-700">来源文本</p>
          {canExpandSource && (
            <button
              type="button"
              onClick={() => setIsSourceExpanded((value) => !value)}
              className="shrink-0 font-medium text-blue-600"
            >
              {isSourceExpanded ? '收起来源文本' : '展开来源文本'}
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words">
          {field.source_text
            ? isSourceExpanded
              ? field.source_text
              : sourcePreview
            : '没有可用来源文本'}
        </p>
      </div>

      {isEditing && (
        <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
          <EditableControl
            fieldName={field.field_name}
            label={label}
            value={draftValue}
            onChange={setDraftValue}
          />
          <p className="text-xs text-blue-700">
            应用只会更新候选值。请随后确认该字段，才会写入正式事实。
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={applyEdit}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              应用{label}修改
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700"
            >
              取消编辑
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <div className="grid gap-2 sm:flex sm:flex-wrap">
        {!isResolved && (
          <button
            type="button"
            onClick={confirm}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
          >
            确认{label}
          </button>
        )}
        <button
          type="button"
          onClick={startEditing}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
        >
          {getEditVerb(field.review_status)}{label}
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
        >
          清空{label}
        </button>
      </div>
    </article>
  )
}

function EditableControl({
  fieldName,
  label,
  value,
  onChange,
}: {
  fieldName: SubscriptionFactFieldName
  label: string
  value: string
  onChange: (value: string) => void
}) {
  if (fieldName === 'renewal_status') {
    return (
      <select
        aria-label={`编辑${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm"
      >
        {RENEWAL_STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {formatRenewalStatus(option)}
          </option>
        ))}
      </select>
    )
  }

  if (fieldName === 'cancellation_status') {
    return (
      <select
        aria-label={`编辑${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm"
      >
        {CANCELLATION_STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {formatCancellationStatus(option)}
          </option>
        ))}
      </select>
    )
  }

  if (fieldName === 'cancellation_steps') {
    return (
      <textarea
        aria-label={`编辑${label}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm"
      />
    )
  }

  return (
    <input
      aria-label={`编辑${label}`}
      type={inputTypeForField(fieldName)}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm"
    />
  )
}

function ValueBlock({ label, value }: { label: string; value: ExtractedFieldValue }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-100 px-3 py-2">
      <p className="font-medium text-gray-700">{label}</p>
      <p className="mt-0.5 break-words text-gray-600">{formatValue(value)}</p>
    </div>
  )
}

function getCurrentFactValue(record: SubscriptionRecord, fieldName: SubscriptionFactFieldName): ExtractedFieldValue {
  switch (fieldName) {
    case 'id':
      return record.facts.id
    case 'service_name':
      return record.facts.service_name
    case 'plan_name':
      return record.facts.plan_name
    case 'category':
      return record.facts.category
    case 'platform':
      return record.facts.platform
    case 'entitlement_type':
      return record.facts.entitlement_type
    case 'membership_start_date':
      return record.facts.membership_start_date
    case 'membership_end_date':
      return record.facts.membership_end_date
    case 'renewal_status':
      return record.facts.renewal_status
    case 'next_charge_date':
      return record.facts.next_charge_date
    case 'renewal_price':
      return record.facts.renewal_price
    case 'currency':
      return record.facts.currency
    case 'billing_cycle':
      return record.facts.billing_cycle
    case 'cancellation_status':
      return record.facts.cancellation_status
    case 'cancellation_path':
      return record.facts.cancellation_path
    case 'cancellation_steps':
      return record.facts.cancellation_steps
    case 'cancellation_deadline':
      return record.facts.cancellation_deadline
    case 'planned_cancel_date':
      return record.facts.planned_cancel_date
    case 'cancellation_completed_at':
      return record.facts.cancellation_completed_at
    case 'cancellation_proof':
      return record.facts.cancellation_proof
    case 'reminder_settings':
      return null
  }
}

function parseEditableValue(fieldName: SubscriptionFactFieldName, value: string): ExtractedFieldValue {
  if (fieldName === 'renewal_price') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  if (fieldName === 'cancellation_steps') {
    return value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return value.trim().length > 0 ? value.trim() : null
}

function toEditableValue(value: ExtractedFieldValue, fieldName: SubscriptionFactFieldName): string {
  if (value === null) return ''
  if (Array.isArray(value)) return value.map(String).join(fieldName === 'cancellation_steps' ? '\n' : ', ')
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function inputTypeForField(fieldName: SubscriptionFactFieldName): string {
  if (fieldName === 'renewal_price') return 'number'
  if (fieldName.endsWith('_date') || fieldName.endsWith('_at')) return 'date'
  return 'text'
}

function formatValue(value: ExtractedFieldValue): string {
  if (value === null) return '缺失'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  return Object.entries(value)
    .map(([key, item]) => `${formatToken(key)}: ${formatValue(item)}`)
    .join(', ')
}

function formatToken(value: string): string {
  return value.replaceAll('_', ' ')
}

function formatSourceSummary(fields: readonly FieldEvidence[]): string {
  const unresolvedCount = fields.filter(isFieldEvidenceUnresolved).length
  return `${fields.length} 个字段 · ${unresolvedCount} 个未解决`
}

function getReviewStateLabel(field: FieldEvidence): string {
  if (field.review_status === 'confirmed' && field.user_confirmed) return '已确认'
  if (field.review_status === 'conflict') return '冲突'
  if (field.review_status === 'missing') return '缺失'
  return '需核对'
}

function getSourcePreview(sourceText: string | null): string {
  if (!sourceText) return ''
  const normalized = sourceText.trim()
  if (normalized.length <= 96) return normalized
  return `${normalized.slice(0, 96).trimEnd()}...`
}

function getEditVerb(reviewStatus: string): string {
  if (reviewStatus === 'missing') return '补充'
  if (reviewStatus === 'conflict') return '解决'
  return '编辑'
}

function formatEvidenceType(value: string): string {
  const labels: Record<string, string> = {
    direct: '直接证据',
    inferred: '推断',
    missing: '缺失',
    conflict: '冲突',
    user_edited: '用户编辑',
  }
  return labels[value] ?? formatToken(value)
}

function formatReviewStatus(value: string): string {
  const labels: Record<string, string> = {
    ready: '可确认',
    needs_review: '需核对',
    missing: '缺失',
    conflict: '冲突',
    confirmed: '已确认',
  }
  return labels[value] ?? formatToken(value)
}

function formatRenewalStatus(value: string): string {
  const labels: Record<string, string> = {
    auto_renew_on: '自动续费中',
    auto_renew_off: '自动续费已关闭',
    manual_renewal: '手动续费',
    not_applicable: '不适用',
    unknown: '未知',
  }
  return labels[value] ?? value
}

function formatCancellationStatus(value: string): string {
  const labels: Record<string, string> = {
    none: '无取消任务',
    planned: '已计划',
    in_progress: '进行中',
    confirmed: '已确认',
  }
  return labels[value] ?? value
}
