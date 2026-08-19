import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'

describe('Batch 2 capture navigation shell', () => {
  it('renders one shared non-semantic top scroll fade from AppShell', () => {
    window.location.hash = '#/'

    render(<App />)

    const fade = screen.getByTestId('app-top-scroll-fade')

    expect(fade).toHaveClass('app-top-scroll-fade')
    expect(fade).toHaveAttribute('aria-hidden', 'true')
    expect(fade).not.toHaveAttribute('tabindex')
    expect(fade).not.toHaveAttribute('role')
    expect(document.querySelectorAll('.app-top-scroll-fade')).toHaveLength(1)
  })

  it('shares the same single top fade across primary, detail, settings, and capture routes', () => {
    const routes = [
      '#/',
      '#/subscriptions',
      '#/subscription/s1',
      '#/settings',
      '#/scan-screenshot',
    ]

    routes.forEach((route, index) => {
      if (index > 0) cleanup()
      window.location.hash = route
      render(<App />)

      const fades = document.querySelectorAll('.app-top-scroll-fade')
      expect(fades).toHaveLength(1)
      expect(fades[0]).toHaveAttribute('aria-hidden', 'true')
    })
  })

  it('renders only Home and My Subscriptions in Bottom Navigation', () => {
    window.location.hash = '#/'

    render(<App />)

    const nav = screen.getByRole('navigation', { name: '主导航' })
    const links = within(nav).getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'My Subscriptions' })).toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: /添加|Add/i })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: /设置|Settings/i })).not.toBeInTheDocument()

    cleanup()
    window.location.hash = '#/subscription/s1'
    render(<App />)

    const detailNav = screen.getByRole('navigation', { name: '主导航' })
    expect(within(detailNav).getByRole('link', { name: 'My Subscriptions' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('routes the Home Right Now CTA to the first non-zero action filter without opening Add membership', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/'

    render(<App />)

    expect(screen.queryByRole('button', { name: /添加记录/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '添加方式面板' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '查看待处理事项' }))

    expect(window.location.hash).toContain('/subscriptions?filter=expiring_soon')
    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()
  })

  it('closes the sheet without losing the Subscriptions source route', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/subscriptions'

    render(<App />)

    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add membership' }))
    const sheet = screen.getByRole('dialog', { name: '添加方式面板' })
    const sheetLayer = sheet.closest('.input-sheet-layer')

    expect(sheetLayer).toHaveClass('z-30')
    expect(document.querySelectorAll('.app-top-scroll-fade')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '关闭' }))

    expect(screen.queryByRole('dialog', { name: '添加方式面板' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/subscriptions')
  })

  it('keeps Add Input Method enabled options visually neutral until a real choice advances', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/subscriptions'

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add membership' }))
    const sheet = screen.getByRole('dialog', { name: '添加方式面板' })
    const scanOption = within(sheet).getByRole('button', { name: '扫描截图' })
    const manualOption = within(sheet).getByRole('button', { name: '手动录入' })
    const voiceOption = within(sheet).getByRole('button', { name: '语音快速添加' })

    expect(scanOption).not.toHaveClass('bg-blue-50')
    expect(scanOption).not.toHaveClass('border-blue-200')
    expect(scanOption).toHaveClass('border-gray-200')
    expect(manualOption).toHaveClass('border-gray-200')
    expect(scanOption).not.toHaveAttribute('aria-selected')
    expect(manualOption).not.toHaveAttribute('aria-selected')
    expect(voiceOption).toBeDisabled()
    expect(voiceOption).not.toHaveClass('bg-blue-50')
    expect(within(sheet).queryByRole('button', { name: /continue|confirm|继续|确认/i }))
      .not.toBeInTheDocument()

    scanOption.focus()
    expect(scanOption).toHaveFocus()
    expect(scanOption).not.toHaveAttribute('aria-selected')
    expect(scanOption).not.toHaveClass('bg-blue-50')
  })

  it('renders My Subscriptions with the page-level brand header and no global app header', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/subscriptions'

    render(<App />)

    expect(screen.queryByRole('banner', { name: 'SubClear 应用' })).not.toBeInTheDocument()
    const subscriptionsPage = document.querySelector('.subscriptions-page') as HTMLElement
    expect(subscriptionsPage).toBeInTheDocument()
    expect(
      within(subscriptionsPage).getByRole('img', { name: 'SubClear logo' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'SubClear logo' })).toHaveLength(1)
    const profileLink = within(subscriptionsPage).getByRole('link', {
      name: 'Open profile, settings, and data',
    })
    expect(within(profileLink).getByTestId('profile-avatar-image')).toHaveAttribute(
      'src',
      '/avatar-placeholder.svg',
    )
    expect(screen.getAllByTestId('profile-avatar-image')).toHaveLength(1)
    expect(within(subscriptionsPage).getByText('你的记录库')).toBeInTheDocument()
    expect(within(subscriptionsPage).getByRole('heading', { name: '记录' })).toBeInTheDocument()
    expect(within(subscriptionsPage).getByText('所有周期性会员信息，集中安静管理。')).toBeInTheDocument()
    expect(within(subscriptionsPage).getByRole('button', { name: '全部' })).toBeInTheDocument()

    await user.click(within(subscriptionsPage).getByRole('button', { name: 'Add membership' }))
    expect(screen.getByRole('dialog', { name: '添加方式面板' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog', { name: '添加方式面板' })).not.toBeInTheDocument()

    await user.click(profileLink)
    expect(window.location.hash).toBe('#/settings')
    expect(screen.getByRole('heading', { name: '设置 / 数据' })).toBeInTheDocument()
  })

  it('keeps brand header ownership limited to the two primary pages', () => {
    const taskRoutes = [
      { route: '#/scan-screenshot', heading: '扫描截图' },
      { route: '#/review-extracted', heading: '添加订阅' },
      { route: '#/add-trial', heading: '添加免费试用' },
      { route: '#/add-paid', heading: '添加付费会员' },
      { route: '#/subscription/s1/reminder', heading: '提醒设置' },
      { route: '#/subscription/s1/cancellation', heading: '计划取消' },
      { route: '#/settings', heading: '设置 / 数据' },
      { route: '#/subscription/s1?focus=evidence', heading: 'Notion Pro' },
    ]

    taskRoutes.forEach(({ route, heading }, index) => {
      if (index > 0) cleanup()
      window.location.hash = route
      render(<App />)

      expect(screen.queryByRole('banner', { name: 'SubClear 应用' })).not.toBeInTheDocument()
      expect(screen.queryByRole('img', { name: 'SubClear logo' })).not.toBeInTheDocument()
      expect(screen.queryByTestId('profile-avatar-image')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
      expect(document.querySelectorAll('.app-top-scroll-fade')).toHaveLength(1)
      expect(within(screen.getByRole('navigation', { name: '主导航' })).getAllByRole('link'))
        .toHaveLength(2)
    })
  })

  it('uses the safe-area detail layout without rendering the global app header', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/subscription/s1'

    render(<App />)

    const shell = document.querySelector('.app-shell') as HTMLElement
    const main = screen.getByRole('main')
    const backButton = within(main).getByRole('button', { name: /返回记录列表/ })
    const detailHeading = within(main).getByRole('heading', { name: 'Notion Pro' })

    expect(shell).toHaveClass('app-shell')
    expect(screen.queryByRole('banner', { name: 'SubClear 应用' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'SubClear logo' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('profile-avatar-image')).not.toBeInTheDocument()
    expect(backButton).toBe(screen.getByTestId('page-back-button'))
    expect(detailHeading).toBeInTheDocument()

    const detailNav = screen.getByRole('navigation', { name: '主导航' })
    expect(within(detailNav).getAllByRole('link')).toHaveLength(2)

    await user.click(backButton)

    await waitFor(() => {
      expect(window.location.hash).toBe('#/subscriptions')
      expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()
    })
  })

  it('keeps the reminder page context without a global brand header', () => {
    window.location.hash = '#/subscription/s1/reminder'

    render(<App />)

    const shell = document.querySelector('.app-shell') as HTMLElement

    expect(shell).toHaveClass('app-shell')
    expect(screen.queryByRole('banner', { name: 'SubClear 应用' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'SubClear logo' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('profile-avatar-image')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /返回 Notion Pro/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '提醒设置' })).toBeInTheDocument()
  })

  it('navigates Scan Screenshot to the upload route and Back returns to the source page', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/subscriptions'

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add membership' }))
    await user.click(screen.getByRole('button', { name: '扫描截图' }))

    expect(window.location.hash).toBe('#/scan-screenshot')
    expect(screen.getByRole('heading', { name: '扫描截图' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回' }))

    await waitFor(() => {
      expect(window.location.hash).toBe('#/subscriptions')
      expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()
    })
  })

  it('keeps Manual Entry connected to the existing trial and paid routes', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/subscriptions'

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add membership' }))
    await user.click(screen.getByRole('button', { name: '手动录入' }))
    await user.click(screen.getByRole('button', { name: '添加免费试用' }))

    expect(window.location.hash).toBe('#/add-trial')
    expect(screen.getByRole('heading', { name: '添加免费试用' })).toBeInTheDocument()

    cleanup()
    window.location.hash = '#/subscriptions'
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add membership' }))
    await user.click(screen.getByRole('button', { name: '手动录入' }))
    await user.click(screen.getByRole('button', { name: '添加付费会员' }))

    expect(window.location.hash).toBe('#/add-paid')
    expect(screen.getByRole('heading', { name: '添加付费会员' })).toBeInTheDocument()
  })

  it('does not let Voice Quick Add navigate or trigger a voice feature', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/subscriptions'

    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add membership' }))
    const voiceButton = screen.getByRole('button', { name: '语音快速添加' })
    expect(voiceButton).toBeDisabled()
    await user.click(voiceButton)

    expect(window.location.hash).toBe('#/subscriptions')
    expect(screen.queryByText(/麦克风/)).not.toBeInTheDocument()
  })

  it('opens Settings / Data from the Home profile avatar entry', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/'

    render(<App />)

    expect(screen.queryByRole('banner', { name: 'SubClear 应用' })).not.toBeInTheDocument()
    const homeIntro = screen.getByTestId('home-page-intro')
    const profileLink = within(homeIntro).getByRole('link', {
      name: 'Open profile, settings, and data',
    })
    expect(within(profileLink).getByTestId('profile-avatar-image')).toBeInTheDocument()
    expect(within(homeIntro).queryByText('账号 / 数据')).not.toBeInTheDocument()
    expect(within(homeIntro).queryByText('本地优先')).not.toBeInTheDocument()
    await user.click(profileLink)

    expect(window.location.hash).toBe('#/settings')
    expect(screen.getByRole('heading', { name: '设置 / 数据' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: '主导航' })
    expect(within(nav).queryByRole('link', { name: /设置|Settings/i })).not.toBeInTheDocument()

    await user.click(within(nav).getByRole('link', { name: 'Home' }))
    expect(window.location.hash).toBe('#/')
    expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument()
    expect(screen.getByTestId('home-page-intro')).toBeInTheDocument()
  })

  it('keeps current legacy routes renderable', () => {
    window.location.hash = '#/add-trial'
    render(<App />)
    expect(screen.getByRole('heading', { name: '添加免费试用' })).toBeInTheDocument()

    cleanup()
    window.location.hash = '#/add-paid'
    render(<App />)
    expect(screen.getByRole('heading', { name: '添加付费会员' })).toBeInTheDocument()

    cleanup()
    window.location.hash = '#/'
    render(<App />)
    expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument()
    expect(screen.getByTestId('home-page-intro')).toBeInTheDocument()
    expect(screen.queryByText('CONTROL ROOM')).not.toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('控制室')).not.toBeInTheDocument()

    cleanup()
    window.location.hash = '#/subscriptions'
    render(<App />)
    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()

    cleanup()
    window.location.hash = '#/settings'
    render(<App />)
    expect(screen.getByRole('heading', { name: '设置 / 数据' })).toBeInTheDocument()
  })
})
