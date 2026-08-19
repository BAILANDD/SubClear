import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('App smoke render', () => {
  it('renders the default dashboard route with the Home-local header', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/'

    render(<App />)

    expect(screen.queryByRole('banner', { name: 'SubClear 应用' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument()

    const homeIntro = screen.getByTestId('home-page-intro')
    expect(within(homeIntro).getByRole('img', { name: 'SubClear logo' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'SubClear logo' })).toHaveLength(1)
    expect(within(homeIntro).queryByRole('heading', { name: 'SubClear' })).not.toBeInTheDocument()
    expect(within(homeIntro).queryByText('SubClear')).not.toBeInTheDocument()
    const profileLink = within(homeIntro).getByRole('link', {
      name: 'Open profile, settings, and data',
    })
    expect(profileLink).toBeInTheDocument()
    const avatarImage = within(profileLink).getByTestId('profile-avatar-image')
    expect(avatarImage).toBeInTheDocument()
    expect(avatarImage).toHaveAttribute('src', '/avatar-placeholder.svg')
    expect(screen.getAllByTestId('profile-avatar-image')).toHaveLength(1)
    fireEvent.error(avatarImage)
    expect(profileLink).toBeInTheDocument()
    profileLink.focus()
    expect(profileLink).toHaveFocus()
    expect(within(homeIntro).queryByText('账号 / 数据')).not.toBeInTheDocument()
    expect(within(homeIntro).queryByText('本地优先')).not.toBeInTheDocument()
    expect(within(homeIntro).queryByText('无需连接银行')).not.toBeInTheDocument()
    expect(screen.getByText('See what renews, what needs review, and what can wait.')).toBeInTheDocument()
    expect(screen.getByText('无需连接银行。SubClear 只记录会员信息和任务。')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '待处理摘要' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('CONTROL ROOM')).not.toBeInTheDocument()
    expect(screen.queryByText('控制室')).not.toBeInTheDocument()

    await user.click(profileLink)
    expect(window.location.hash).toBe('#/settings')
    expect(screen.getByRole('heading', { name: '设置 / 数据' })).toBeInTheDocument()
  })

  it('quietly styles zero-count Home actions without changing order or navigation', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/'

    render(<App />)

    const summary = screen.getByRole('region', { name: '待处理摘要' })
    expect(within(summary).getByText('2')).toBeInTheDocument()
    expect(within(summary).getByRole('link', { name: '查看待处理事项' })).toBeInTheDocument()

    const needsReview = screen.getByRole('link', { name: /待确认，0 条记录/ })
    expect(needsReview).toHaveClass('action-card--quiet')
    expect(within(needsReview).getByText('0')).toBeInTheDocument()
    expect(within(needsReview).queryByText('00')).not.toBeInTheDocument()

    const expiringSoon = screen.getByRole('link', { name: /即将到期，1 条记录/ })
    expect(expiringSoon).not.toHaveClass('action-card--quiet')
    expect(within(expiringSoon).getByText('1')).toBeInTheDocument()
    expect(within(expiringSoon).queryByText('01')).not.toBeInTheDocument()

    const upcomingCharges = screen.getByRole('link', { name: /即将扣费，0 条记录/ })
    expect(upcomingCharges).toHaveClass('action-card--quiet')
    expect(within(upcomingCharges).getByText('0')).toBeInTheDocument()
    expect(within(upcomingCharges).queryByText('00')).not.toBeInTheDocument()

    const cancellationTasks = screen.getByRole('link', { name: /取消计划，1 条记录/ })
    expect(cancellationTasks).not.toHaveClass('action-card--quiet')
    expect(within(cancellationTasks).getByText('1')).toBeInTheDocument()
    expect(within(cancellationTasks).queryByText('01')).not.toBeInTheDocument()

    expect(
      screen.getAllByRole('link', { name: /，\d+ 条记录/ }).map((card) => card.getAttribute('aria-label')),
    ).toEqual(['待确认，0 条记录', '即将到期，1 条记录', '即将扣费，0 条记录', '取消计划，1 条记录'])

    const nav = screen.getByRole('navigation', { name: '主导航' })
    expect(within(nav).getAllByRole('link')).toHaveLength(2)

    await user.click(needsReview)

    expect(window.location.hash).toContain('/subscriptions?filter=needs_review')
    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()
  })
})
