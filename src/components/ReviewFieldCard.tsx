import { useState } from 'react'
import type { ExtractedFieldValue, FieldEvidence, SubscriptionFactFieldName } from '../types/evidence'

interface ReviewFieldCardProps {
  field: FieldEvidence
  label: string
  supportsNotApplicable: boolean
  onConfirm: () => void
  onEdit: (value: ExtractedFieldValue) => void
  onClear: () => void
  onNotApplicable: () => void
}

const RENEWAL_STATUS_OPTIONS = [
  'auto_renew_on',
  'auto_renew_off',
  'manual_renewal',
  'not_applicable',
  'unknown',
]

export default function ReviewFieldCard({
  field,
  label,
  supportsNotApplicable,
  onConfirm,
  onEdit,
  onClear,
  onNotApplicable,
}: ReviewFieldCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(toEditableValue(field.extracted_value))
  const [isSourceExpanded, setIsSourceExpanded] = useState(false)
  const editActionLabel = editLabel(field.field_name, field.review_status)

  function startEditing() {
    setDraftValue(toEditableValue(field.extracted_value))
    setIsEditing(true)
  }

  function applyEdit() {
    onEdit(parseEditableValue(field.field_name, draftValue))
    setIsEditing(false)
  }

  return (
    <article
      data-testid={`field-${field.field_name}`}
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">{label}</h4>
          <p className="mt-1 text-sm text-gray-700">{formatFieldValue(field.field_name, field.extracted_value)}</p>
        </div>
        <div className="shrink-0 space-y-1 text-right text-[11px] font-medium text-gray-500">
          <p>证据类型：{formatEvidenceType(field.evidence_type)}</p>
          <p>核对状态：{formatReviewStatus(field.review_status)}</p>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700">来源文本</span>
          {field.source_text && field.source_text.length > 56 && (
            <button
              type="button"
              onClick={() => setIsSourceExpanded((value) => !value)}
              className="font-medium text-blue-600"
            >
              {isSourceExpanded ? '收起' : '展开'}
            </button>
          )}
        </div>
        <p className={isSourceExpanded ? 'mt-1' : 'mt-1 line-clamp-2'}>
          {field.source_text ?? '没有可用来源文本'}
        </p>
      </div>

      {isEditing && (
        <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
          {field.field_name === 'renewal_status' ? (
            <select
              aria-label={`编辑${label}`}
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm"
            >
              {RENEWAL_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatReviewOption(option)}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={`编辑${label}`}
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm"
            />
          )}
          <div className="flex gap-2">
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
        >
          确认{label}
        </button>
        <button
          type="button"
          onClick={startEditing}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
        >
          {editActionLabel}{label}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
        >
          清空{label}
        </button>
        {supportsNotApplicable && (
          <button
            type="button"
            onClick={onNotApplicable}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
          >
            标记{label}不适用
          </button>
        )}
      </div>
    </article>
  )
}

function formatStatus(value: string): string {
  return value.replaceAll('_', ' ')
}

function formatEvidenceType(value: string): string {
  const labels: Record<string, string> = {
    direct: '直接证据',
    inferred: '推断',
    missing: '缺失',
    conflict: '冲突',
    user_edited: '用户编辑',
  }
  return labels[value] ?? formatStatus(value)
}

function formatReviewStatus(value: string): string {
  const labels: Record<string, string> = {
    ready: '可确认',
    needs_review: '需核对',
    missing: '缺失',
    conflict: '冲突',
    confirmed: '已确认',
  }
  return labels[value] ?? formatStatus(value)
}

function formatReviewOption(value: string): string {
  const labels: Record<string, string> = {
    auto_renew_on: '自动续费中',
    auto_renew_off: '自动续费已关闭',
    manual_renewal: '手动续费',
    not_applicable: '不适用',
    unknown: '未知',
  }
  return labels[value] ?? value
}

function formatFieldValue(fieldName: SubscriptionFactFieldName, value: ExtractedFieldValue): string {
  if (fieldName === 'renewal_status' && typeof value === 'string') {
    return formatReviewOption(value)
  }

  if (fieldName === 'billing_cycle' && typeof value === 'string') {
    return formatBillingCycle(value)
  }

  return formatValue(value)
}

function formatValue(value: ExtractedFieldValue): string {
  if (value === null) return '缺失'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join(', ')

  if ('candidates' in value && Array.isArray(value.candidates)) {
    return `冲突：${value.candidates.map((item) => formatValue(item)).join(' / ')}`
  }

  return Object.entries(value)
    .map(([key, item]) => `${formatStatus(key)}: ${formatValue(item)}`)
    .join(', ')
}

function formatBillingCycle(value: string): string {
  const labels: Record<string, string> = {
    monthly: '每月',
    yearly: '每年',
    weekly: '每周',
    quarterly: '每季度',
    custom: '自定义周期',
    unknown: '未确认',
  }
  return labels[value] ?? value
}

function toEditableValue(value: ExtractedFieldValue): string {
  if (value === null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function parseEditableValue(fieldName: SubscriptionFactFieldName, value: string): ExtractedFieldValue {
  if (fieldName === 'renewal_price') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }

  return value.trim().length > 0 ? value.trim() : null
}

function editLabel(fieldName: SubscriptionFactFieldName, reviewStatus: string): string {
  if (reviewStatus === 'missing') return '补充'
  if (reviewStatus === 'conflict' || fieldName === 'renewal_price') return '解决'
  return '编辑'
}
