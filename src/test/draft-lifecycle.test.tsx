import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { createFixtureCaptureDraft } from '../fixtures/membershipFixture'
import ReviewExtractedDetails from '../pages/ReviewExtractedDetails'
import { SubscriptionProvider } from '../store/SubscriptionProvider'

function draft() {
  return createFixtureCaptureDraft({
    file: new File([new Uint8Array([1])], 'subclear-membership-demo.png', { type: 'image/png' }),
    capturedAt: '2026-07-15T00:00:00.000Z',
    sessionId: 'draft_lifecycle_test',
  })
}

function renderReview() {
  return render(
    <SubscriptionProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/review-extracted',
            state: { draft: draft() },
          },
        ]}
      >
        <Routes>
          <Route path="/review-extracted" element={<ReviewExtractedDetails />} />
          <Route path="/scan-screenshot" element={<h1>扫描截图</h1>} />
          <Route path="/subscription/:id" element={<h1>已保存详情</h1>} />
        </Routes>
      </MemoryRouter>
    </SubscriptionProvider>,
  )
}

describe('draft lifecycle and save failure handling', () => {
  it('asks for discard confirmation before leaving an unsaved review draft', async () => {
    const user = userEvent.setup()
    renderReview()

    await user.click(screen.getByRole('button', { name: '返回' }))

    expect(screen.getByRole('dialog', { name: /放弃草稿/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '继续编辑' }))
    expect(screen.queryByRole('dialog', { name: /放弃草稿/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回' }))
    await user.click(screen.getByRole('button', { name: '放弃草稿' }))
    expect(screen.getByRole('heading', { name: '扫描截图' })).toBeInTheDocument()
  })

  it('lets Escape close discard confirmation and keep the current review draft', async () => {
    const user = userEvent.setup()
    renderReview()

    await user.click(screen.getByRole('button', { name: '返回' }))
    expect(screen.getByRole('dialog', { name: /放弃草稿/ })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: /放弃草稿/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '添加订阅' })).toBeInTheDocument()
    expect(screen.getByLabelText('服务名称')).toHaveValue('Aurora Plus')
  })

  it('shows save failure and does not claim success when canonical storage is blocked', async () => {
    const user = userEvent.setup()
    localStorage.setItem('subclear_subscriptions', JSON.stringify({ schema_version: 999, records: [] }))
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('22222222-2222-4222-8222-222222222222')
    renderReview()

    await user.click(screen.getByRole('button', { name: '确认并保存' }))

    await waitFor(() =>
      expect(screen.getByText(/当前无法保存/)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/saved successfully|subscription created/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '已保存详情' })).not.toBeInTheDocument()
  })
})
