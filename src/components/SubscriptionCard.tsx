import type { ReactNode } from 'react'
import { formatDate } from '../utils/date'
import MembershipBadge from './MembershipBadge'
import RenewalBadge from './RenewalBadge'
import {
  getCancellationIndicator,
  getMembershipStatus,
  getNextRelevantDate,
  summarizeEvidence,
} from '../presentation/subscriptionPresentation'
import type { SubscriptionRecord } from '../types'

interface SubscriptionCardProps {
  onClick?: () => void
  children?: ReactNode
  record?: SubscriptionRecord
  referenceDate?: string
  actions?: ReactNode
  highlight?: boolean
}

export default function SubscriptionCard({
  onClick,
  children,
  record,
  referenceDate,
  actions,
  highlight = false,
}: SubscriptionCardProps) {
  const content =
    record && referenceDate ? (
      <CanonicalCardContent record={record} referenceDate={referenceDate} />
    ) : (
      children
    )

  return (
    <div
      onClick={onClick}
      className={`subscription-card ${highlight ? 'is-highlighted' : ''} ${
        onClick ? 'is-clickable' : ''
      }`}
    >
      <div className="subscription-card-layout">
        <div className="subscription-card-content">{content}</div>
        {actions && <div className="flex flex-col gap-1.5 shrink-0">{actions}</div>}
        {onClick && <span className="subscription-card-arrow" aria-hidden="true">↗</span>}
      </div>
    </div>
  )
}

function CanonicalCardContent({
  record,
  referenceDate,
}: {
  record: SubscriptionRecord
  referenceDate: string
}) {
  const membershipStatus = getMembershipStatus(record, referenceDate)
  const nextRelevantDate = getNextRelevantDate(record, referenceDate)
  const cancellationIndicator = getCancellationIndicator(record.facts.cancellation_status)
  const evidence = summarizeEvidence(record)

  return (
    <div className="canonical-card-content">
      <div className="service-row">
        <span className="service-monogram" aria-hidden="true">
          {record.facts.service_name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="service-name-group">
          <p>{record.facts.service_name}</p>
        {record.facts.plan_name && (
            <span>{record.facts.plan_name}</span>
        )}
        </div>
      </div>

      <div className="card-badges">
        <MembershipBadge status={membershipStatus} />
        <RenewalBadge status={record.facts.renewal_status} />
      </div>

      {nextRelevantDate && (
        <div className="relevant-date">
          <span>{nextRelevantDate.label}</span>
          <strong>{formatDate(nextRelevantDate.value)}</strong>
        </div>
      )}

      <div className="card-flags">
        {cancellationIndicator && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            {cancellationIndicator}
          </span>
        )}
        {evidence.needsReview && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            待确认
          </span>
        )}
      </div>
    </div>
  )
}
