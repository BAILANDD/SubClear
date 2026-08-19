import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAddMembership } from '../components/AddMembershipContext'
import EmptyState from '../components/EmptyState'
import PageBrandHeader from '../components/PageBrandHeader'
import SubscriptionCard from '../components/SubscriptionCard'
import { getReferenceDate, getSelectorOptions } from '../presentation/subscriptionPresentation'
import { filterSubscriptionRecords, type SubscriptionFilter } from '../selectors/subscriptions'
import { useSubscriptions } from '../store/useSubscriptions'

const filters: { key: SubscriptionFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'needs_review', label: '待确认' },
  { key: 'expiring_soon', label: '即将到期' },
  { key: 'upcoming_charges', label: '即将扣费' },
  { key: 'auto_renew_on', label: '自动续费中' },
  { key: 'cancellation_tasks', label: '取消计划' },
  { key: 'expired', label: '已过期' },
]

const filterKeys = new Set<SubscriptionFilter>(filters.map((filter) => filter.key))
const actionBadgeFilterKeys = new Set<SubscriptionFilter>([
  'needs_review',
  'expiring_soon',
  'upcoming_charges',
  'cancellation_tasks',
])

const emptyMessages: Record<SubscriptionFilter, { title: string; description: string }> = {
  all: {
    title: '还没有记录',
    description: '添加会员记录或扫描截图即可开始。',
  },
  needs_review: {
    title: '没有待确认记录',
    description: '已经处理完毕。包含未解决证据的记录会显示在这里。',
  },
  expiring_soon: {
    title: '没有即将到期的会员',
    description: '当前提醒阈值内没有到期记录。',
  },
  upcoming_charges: {
    title: '没有即将扣费的记录',
    description: '近期窗口内没有自动续费扣费日期。',
  },
  auto_renew_on: {
    title: '没有自动续费记录',
    description: '开启自动续费的记录会显示在这里。',
  },
  cancellation_tasks: {
    title: '没有取消计划',
    description: '已创建且尚未完成的取消计划会显示在这里。',
  },
  expired: {
    title: '没有已过期记录',
    description: '已过期会员会保留在这里方便查阅。',
  },
}

export default function SubscriptionList() {
  const { openAddMembershipSheet } = useAddMembership()
  const { records, storageError } = useSubscriptions()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const rawFilter = searchParams.get('filter')
  const selectedFilter = parseFilter(rawFilter)
  const referenceDate = getReferenceDate()
  const selectorOptions = getSelectorOptions(referenceDate)
  const filtered = filterSubscriptionRecords(records, selectedFilter, selectorOptions)
  const isEmpty = filtered.length === 0

  useEffect(() => {
    if (rawFilter && !filterKeys.has(rawFilter as SubscriptionFilter)) {
      setSearchParams({}, { replace: true })
    }
  }, [rawFilter, setSearchParams])

  function changeFilter(filter: SubscriptionFilter) {
    if (filter === 'all') {
      setSearchParams({})
      return
    }
    setSearchParams({ filter })
  }

  function getBadgeCount(filter: SubscriptionFilter): number {
    if (!actionBadgeFilterKeys.has(filter)) {
      return 0
    }
    return filterSubscriptionRecords(records, filter, selectorOptions).length
  }

  return (
    <div className="subscriptions-page">
      <div className="page-intro page-brand-intro">
        <PageBrandHeader testId="subscriptions-page-brand-header" />
        <div className="page-intro-with-action">
          <div>
            <span className="page-kicker">你的记录库</span>
            <h2>记录</h2>
            <p>所有周期性会员信息，集中安静管理。</p>
          </div>
          <button
            type="button"
            onClick={openAddMembershipSheet}
            className="round-add-link"
            aria-label="Add membership"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>

      {storageError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {storageError} 筛选视图将以安全只读模式显示。
        </div>
      )}

      <div className="filter-rail" aria-label="记录筛选">
        {filters.map((filter) => {
          const badgeCount = getBadgeCount(filter.key)
          const badgeLabel = badgeCount > 0 ? formatBadgeCount(badgeCount) : null

          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => changeFilter(filter.key)}
              className={`filter-chip ${
                selectedFilter === filter.key ? 'is-selected bg-blue-600 text-white' : ''
              }`}
              aria-label={badgeCount > 0 ? `${filter.label}，${badgeCount} 条记录` : undefined}
            >
              <span>{filter.label}</span>
              {badgeLabel && (
                <span
                  className="filter-chip-badge"
                  data-testid={`filter-badge-${filter.key}`}
                  aria-hidden="true"
                >
                  {badgeLabel}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!isEmpty && (
        <div className="record-count">
          <span>{filtered.length.toString().padStart(2, '0')}</span>
          <span>条记录</span>
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          title={emptyMessages[selectedFilter].title}
          description={emptyMessages[selectedFilter].description}
          action={
            selectedFilter === 'all' ? (
              <button
                type="button"
                onClick={openAddMembershipSheet}
                className="text-sm font-medium text-blue-600 underline"
              >
                添加记录
              </button>
            ) : (
              <button
                type="button"
                onClick={() => changeFilter('all')}
                className="text-sm font-medium text-blue-600 underline"
              >
                查看全部
              </button>
            )
          }
        />
      ) : (
        <div className="subscription-stack">
          {filtered.map((record) => (
            <SubscriptionCard
              key={record.facts.id}
              record={record}
              referenceDate={referenceDate}
              onClick={() => navigate(`/subscription/${record.facts.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : count.toString()
}

function parseFilter(value: string | null): SubscriptionFilter {
  if (value && filterKeys.has(value as SubscriptionFilter)) {
    return value as SubscriptionFilter
  }
  return 'all'
}
