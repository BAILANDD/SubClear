import { summarizeEvidence } from '../presentation/subscriptionPresentation'
import type { SubscriptionRecord } from '../types'

export default function EvidenceSummary({ record }: { record: SubscriptionRecord }) {
  const summary = summarizeEvidence(record)

  if (summary.evidenceRecordCount === 0) {
    return <p className="text-xs text-gray-500">没有已捕获证据。</p>
  }

  return (
    <div className="space-y-1 text-xs text-gray-500">
      <p>
        {summary.evidenceRecordCount} 条证据记录 · {summary.extractedFieldCount} 个识别字段
      </p>
      {summary.unresolvedFieldCount > 0 ? (
        <p className="font-medium text-amber-700">
          待确认：{summary.unresolvedFieldCount} 个未解决字段
        </p>
      ) : (
        <p className="text-green-700">所有核对问题已解决。</p>
      )}
    </div>
  )
}
