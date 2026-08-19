import type { MembershipStatus } from '../types'
import { getMembershipLabel } from '../presentation/subscriptionPresentation'

const styles: Record<MembershipStatus, string> = {
  trial: 'bg-purple-50 text-purple-700',
  active: 'bg-green-50 text-green-700',
  expiring_soon: 'bg-amber-50 text-amber-700',
  expired: 'bg-gray-100 text-gray-500',
  unknown: 'bg-slate-100 text-slate-500',
}

export default function MembershipBadge({ status }: { status: MembershipStatus }) {
  return (
    <span className={`status-badge inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {getMembershipLabel(status)}
    </span>
  )
}
