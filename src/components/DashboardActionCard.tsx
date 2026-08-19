import { Link } from 'react-router-dom'
import { getDashboardActionHref, type DashboardActionFilter } from '../utils/dashboardActions'

interface DashboardActionCardProps {
  title: string
  count: number
  description: string
  filter: DashboardActionFilter
}

export default function DashboardActionCard({
  title,
  count,
  description,
  filter,
}: DashboardActionCardProps) {
  const className = count === 0 ? 'action-card action-card--quiet' : 'action-card'

  return (
    <Link
      to={getDashboardActionHref(filter)}
      className={className}
      data-tone={toneForFilter(filter)}
      aria-label={`${title}，${count} 条记录`}
    >
      <div className="action-card-topline">
        <span>{title}</span>
        <span className="action-arrow" aria-hidden="true">↗</span>
      </div>
      <strong>{count}</strong>
      <p>{description}</p>
    </Link>
  )
}

function toneForFilter(filter: DashboardActionCardProps['filter']): string {
  const tones: Record<DashboardActionCardProps['filter'], string> = {
    needs_review: 'yellow',
    expiring_soon: 'beige',
    upcoming_charges: 'peach',
    cancellation_tasks: 'blue-gray',
  }
  return tones[filter]
}
