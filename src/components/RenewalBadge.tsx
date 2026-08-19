import type { RenewalStatus } from '../types'
import { getRenewalLabel } from '../presentation/subscriptionPresentation'

const styles: Record<RenewalStatus, string> = {
  auto_renew_on: 'bg-blue-50 text-blue-700',
  auto_renew_off: 'bg-gray-100 text-gray-600',
  manual_renewal: 'bg-indigo-50 text-indigo-700',
  not_applicable: 'bg-stone-100 text-stone-600',
  unknown: 'bg-slate-100 text-slate-500',
}

export default function RenewalBadge({
  status,
  label,
}: {
  status: RenewalStatus
  label?: string
}) {
  return (
    <span className={`status-badge inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {label ?? getRenewalLabel(status)}
    </span>
  )
}
