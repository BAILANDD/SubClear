import type { SubscriptionStatus } from '../types'

const styles: Record<SubscriptionStatus, string> = {
  active: 'bg-green-50 text-green-700',
  planned_to_cancel: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const labels: Record<SubscriptionStatus, string> = {
  active: '有效',
  planned_to_cancel: '已计划取消',
  cancelled: '已取消',
}

export default function StatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <span
      className={`status-badge inline-block text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}
    >
      {labels[status]}
    </span>
  )
}
