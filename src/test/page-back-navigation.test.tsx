import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { APP_ROUTES } from '../appRoutes'

describe('secondary page Back navigation', () => {
  it('gives direct-entry Add Free Trial a shared Back control with subscriptions fallback', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/add-trial'

    render(<App />)

    const back = screen.getByTestId('page-back-button')
    expect(back).toHaveRole('button')
    expect(back).toHaveAccessibleName('返回')
    expect(back).toHaveClass('page-back-button')
    expect(back).toHaveAttribute('aria-label', '返回')

    await user.click(back)

    await waitFor(() => expect(window.location.hash).toBe('#/subscriptions'))
    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()
  })

  it('enforces one Back control on every configured secondary route and none on primary routes', () => {
    APP_ROUTES.forEach((route, index) => {
      if (index > 0) cleanup()
      window.location.hash = `#${route.testPath}`

      render(<App />)

      const backControls = screen.queryAllByTestId('page-back-button')
      const nav = screen.getByRole('navigation', { name: '主导航' })

      if (route.level === 'primary') {
        expect(backControls).toHaveLength(0)
        expect(screen.getAllByRole('img', { name: 'SubClear logo' })).toHaveLength(1)
        expect(screen.getAllByTestId('profile-avatar-image')).toHaveLength(1)
      } else {
        expect(backControls).toHaveLength(1)
        expect(backControls[0]).toHaveAccessibleName()
        expect(backControls[0]).toHaveClass('page-back-button')
        expect(screen.getByRole('heading', { name: route.heading })).toBeInTheDocument()
        expect(screen.queryByRole('img', { name: 'SubClear logo' })).not.toBeInTheDocument()
        expect(screen.queryByTestId('profile-avatar-image')).not.toBeInTheDocument()
      }

      expect(document.querySelectorAll('.app-top-scroll-fade')).toHaveLength(1)
      expect(within(nav).getAllByRole('link')).toHaveLength(2)
    })
  })

  it('applies the shared secondary-page spacing hook only to secondary routes', () => {
    APP_ROUTES.forEach((route, index) => {
      if (index > 0) cleanup()
      window.location.hash = `#${route.testPath}`

      render(<App />)

      const pageRoot = screen.getByRole('main').firstElementChild

      if (route.level === 'secondary') {
        expect(pageRoot).toHaveClass('secondary-page')
      } else {
        expect(pageRoot).not.toHaveClass('secondary-page')
      }
    })
  })

  it('uses Router history to return every secondary route to its actual parent context', async () => {
    const user = userEvent.setup()
    const scenarios = [
      { source: '/subscriptions', target: '/subscription/s1' },
      { source: '/subscriptions', target: '/scan-screenshot' },
      { source: '/scan-screenshot', target: '/review-extracted' },
      { source: '/subscriptions', target: '/add-trial' },
      { source: '/subscriptions', target: '/add-paid' },
      { source: '/subscription/s1', target: '/subscription/s1/reminder' },
      { source: '/subscription/s1', target: '/subscription/s1/cancellation' },
      { source: '/', target: '/settings' },
      { source: '/subscriptions', target: '/settings' },
    ]

    for (const [index, scenario] of scenarios.entries()) {
      if (index > 0) cleanup()
      window.history.replaceState({ idx: 0, key: 'source' }, '', `#${scenario.source}`)
      window.history.pushState({ idx: 1, key: 'task' }, '', `#${scenario.target}`)
      render(<App />)

      await user.click(screen.getByTestId('page-back-button'))

      await waitFor(() => expect(window.location.hash).toBe(`#${scenario.source}`))
    }
  })

  it('uses each configured fallback for direct-entry secondary routes', async () => {
    const user = userEvent.setup()
    const secondaryRoutes = APP_ROUTES.filter((route) => route.level === 'secondary')

    for (const [index, route] of secondaryRoutes.entries()) {
      if (index > 0) cleanup()
      window.history.replaceState(null, '', `#${route.testPath}`)
      render(<App />)

      await user.click(screen.getByTestId('page-back-button'))

      await waitFor(() => expect(window.location.hash).toBe(`#${route.fallback}`))
    }
  })

  it('does not reset manual-entry form state when the shared Back control initializes', async () => {
    const user = userEvent.setup()
    const scenarios = [
      { route: '/add-trial', placeholder: '例如：Notion Pro', value: 'Linear Trial' },
      { route: '/add-paid', placeholder: '例如：Spotify Premium', value: 'Figma Pro' },
    ]

    for (const [index, scenario] of scenarios.entries()) {
      if (index > 0) cleanup()
      window.history.replaceState(null, '', `#${scenario.route}`)
      render(<App />)

      const serviceInput = screen.getByPlaceholderText(scenario.placeholder)
      await user.type(serviceInput, scenario.value)
      screen.getByTestId('page-back-button').focus()

      expect(screen.getByTestId('page-back-button')).toHaveFocus()
      expect(serviceInput).toHaveValue(scenario.value)
    }
  })
})
