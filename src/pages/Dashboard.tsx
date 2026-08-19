import { Link } from 'react-router-dom'
import BoundaryNotice from '../components/BoundaryNotice'
import DashboardActionCard from '../components/DashboardActionCard'
import EmptyState from '../components/EmptyState'
import PageBrandHeader from '../components/PageBrandHeader'
import { getReferenceDate, getSelectorOptions } from '../presentation/subscriptionPresentation'
import { deriveDashboardCounts } from '../selectors/subscriptions'
import { useSubscriptions } from '../store/useSubscriptions'
import { getFirstPendingDashboardActionHref } from '../utils/dashboardActions'

export default function Dashboard() {
  const { records, storageError } = useSubscriptions()
  const referenceDate = getReferenceDate()
  const counts = deriveDashboardCounts(records, getSelectorOptions(referenceDate))
  const totalActions =
    counts.needsReview + counts.expiringSoon + counts.upcomingCharges + counts.cancellationTasks
  const rightNowCtaHref = getFirstPendingDashboardActionHref(counts)

  return (
    <div className="dashboard-page">
      <div className="page-intro home-page-intro" data-testid="home-page-intro">
        <PageBrandHeader />
        <p>See what renews, what needs review, and what can wait.</p>
      </div>

      <BoundaryNotice text="无需连接银行。SubClear 只记录会员信息和任务。" />

      {storageError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {storageError} 管理视图将以安全只读模式显示。
        </div>
      )}

      <section className="attention-hero" aria-label="待处理摘要">
        <div className="attention-copy">
          <span className="attention-eyebrow">现在</span>
          <div className="attention-count-row">
            <strong>{totalActions}</strong>
            <p>个事项<br />需要你处理</p>
          </div>
        </div>
        {rightNowCtaHref && (
          <Link to={rightNowCtaHref} className="hero-add-button">
            <span>查看待处理事项</span>
            <span aria-hidden="true">↗</span>
          </Link>
        )}
        <span className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <span className="hero-orbit hero-orbit-two" aria-hidden="true" />
      </section>

      {records.length === 0 ? (
        <EmptyState
          title="还没有记录"
          description="添加会员记录或扫描截图，开始追踪下一步行动。"
        />
      ) : (
        <section className="dashboard-actions" aria-label="Home actions">
          <div className="section-heading">
            <div>
              <span>下一步行动</span>
              <h3>把琐碎的事安静地管好。</h3>
            </div>
            <Link to="/subscriptions">查看全部</Link>
          </div>
          <DashboardActionCard
            title="待确认"
            count={counts.needsReview}
            description="包含需要确认或清理字段的记录。"
            filter="needs_review"
          />
          <DashboardActionCard
            title="即将到期"
            count={counts.expiringSoon}
            description="进入提醒阈值内的会员记录。"
            filter="expiring_soon"
          />
          <DashboardActionCard
            title="即将扣费"
            count={counts.upcomingCharges}
            description="自动续费且即将产生扣费的记录。"
            filter="upcoming_charges"
          />
          <DashboardActionCard
            title="取消计划"
            count={counts.cancellationTasks}
            description="已创建且尚未完成的取消计划。"
            filter="cancellation_tasks"
          />
        </section>
      )}

      {records.length > 0 && totalActions === 0 && (
        <div className="all-clear-message">
          当前没有紧急事项。
        </div>
      )}
    </div>
  )
}
