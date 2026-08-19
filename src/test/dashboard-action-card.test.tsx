import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import DashboardActionCard from '../components/DashboardActionCard'

describe('DashboardActionCard', () => {
  it('uses the blue-gray category variant for non-zero cancellation tasks', () => {
    render(
      <MemoryRouter>
        <DashboardActionCard
          title="取消计划"
          count={1}
          description="已创建且尚未完成的取消计划。"
          filter="cancellation_tasks"
        />
      </MemoryRouter>,
    )

    const card = screen.getByRole('link', { name: /取消计划，1 条记录/ })

    expect(card).toHaveAttribute('data-tone', 'blue-gray')
    expect(card).not.toHaveClass('action-card--quiet')
    expect(card).toHaveAttribute('href', '/subscriptions?filter=cancellation_tasks')
  })

  it('assigns four distinct category variants independently of the non-zero count', () => {
    const cards = [
      { title: '待确认一', count: 1, filter: 'needs_review', tone: 'yellow' },
      { title: '即将到期一', count: 1, filter: 'expiring_soon', tone: 'beige' },
      { title: '即将扣费一', count: 1, filter: 'upcoming_charges', tone: 'peach' },
      { title: '取消计划一', count: 1, filter: 'cancellation_tasks', tone: 'blue-gray' },
      { title: '待确认五', count: 5, filter: 'needs_review', tone: 'yellow' },
    ] as const

    render(
      <MemoryRouter>
        {cards.map((card) => (
          <DashboardActionCard
            key={card.title}
            title={card.title}
            count={card.count}
            description="测试分类颜色。"
            filter={card.filter}
          />
        ))}
      </MemoryRouter>,
    )

    const renderedTones = cards.map((card) => {
      const renderedCard = screen.getByRole('link', {
        name: `${card.title}，${card.count} 条记录`,
      })
      expect(renderedCard).toHaveAttribute('data-tone', card.tone)
      expect(renderedCard).not.toHaveClass('action-card--quiet')
      return renderedCard.getAttribute('data-tone')
    })

    expect(new Set(renderedTones.slice(0, 4))).toHaveLength(4)
    expect(renderedTones[0]).toBe(renderedTones[4])
  })

  it('uses the shared quiet state for zero counts across every category', () => {
    const cards = [
      { title: '待确认', filter: 'needs_review', tone: 'yellow' },
      { title: '即将到期', filter: 'expiring_soon', tone: 'beige' },
      { title: '即将扣费', filter: 'upcoming_charges', tone: 'peach' },
      { title: '取消计划', filter: 'cancellation_tasks', tone: 'blue-gray' },
    ] as const

    render(
      <MemoryRouter>
        {cards.map((card) => (
          <DashboardActionCard
            key={card.filter}
            title={card.title}
            count={0}
            description="当前没有事项。"
            filter={card.filter}
          />
        ))}
      </MemoryRouter>,
    )

    cards.forEach((card) => {
      const renderedCard = screen.getByRole('link', { name: `${card.title}，0 条记录` })
      expect(renderedCard).toHaveClass('action-card--quiet')
      expect(renderedCard).toHaveAttribute('data-tone', card.tone)
      expect(renderedCard).toHaveAttribute(
        'href',
        `/subscriptions?filter=${card.filter}`,
      )
    })
  })

  it('derives the quiet visual state from the current count without changing navigation', () => {
    const { rerender } = render(
      <MemoryRouter>
        <DashboardActionCard
          title="即将到期"
          count={0}
          description="进入提醒阈值内的会员记录。"
          filter="expiring_soon"
        />
      </MemoryRouter>,
    )

    const quietCard = screen.getByRole('link', { name: /即将到期，0 条记录/ })

    expect(quietCard).toHaveClass('action-card--quiet')
    expect(quietCard).toHaveAttribute('href', '/subscriptions?filter=expiring_soon')

    rerender(
      <MemoryRouter>
        <DashboardActionCard
          title="即将到期"
          count={1}
          description="进入提醒阈值内的会员记录。"
          filter="expiring_soon"
        />
      </MemoryRouter>,
    )

    const emphasizedCard = screen.getByRole('link', { name: /即将到期，1 条记录/ })

    expect(emphasizedCard).not.toHaveClass('action-card--quiet')
    expect(emphasizedCard).toHaveAttribute('data-tone', 'beige')
    expect(emphasizedCard).toHaveAttribute('href', '/subscriptions?filter=expiring_soon')
  })

  it('renders double-digit action counts without truncation or leading zeros', () => {
    render(
      <MemoryRouter>
        <DashboardActionCard
          title="待确认"
          count={12}
          description="包含需要确认或清理字段的记录。"
          filter="needs_review"
        />
      </MemoryRouter>,
    )

    const card = screen.getByRole('link', { name: /待确认，12 条记录/ })

    expect(within(card).getByText('12')).toBeInTheDocument()
    expect(within(card).queryByText('012')).not.toBeInTheDocument()
    expect(within(card).queryByText('0012')).not.toBeInTheDocument()
    expect(card).toHaveAttribute('href', '/subscriptions?filter=needs_review')
  })
})
