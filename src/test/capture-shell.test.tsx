import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScreenshotUpload from '../pages/ScreenshotUpload'

const { extractSubscriptionScreenshotMock } = vi.hoisted(() => ({
  extractSubscriptionScreenshotMock: vi.fn(),
}))

vi.mock('../ai/extractionClient', () => ({
  extractSubscriptionScreenshot: extractSubscriptionScreenshotMock,
}))

let objectUrlCount = 0

function imageFile(name = 'membership.png', type = 'image/png', size = 100): File {
  return new File([new Uint8Array(size)], name, { type })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function renderUpload(initialState?: Record<string, unknown>) {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/scan-screenshot',
          state: initialState,
        },
      ]}
    >
      <Routes>
        <Route path="/scan-screenshot" element={<ScreenshotUpload />} />
        <Route path="/" element={<h1>Home</h1>} />
        <Route path="/subscriptions" element={<h1>记录</h1>} />
        <Route path="/add-trial" element={<h1>添加免费试用</h1>} />
        <Route path="/add-paid" element={<h1>添加付费会员</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Screenshot Upload shell', () => {
  beforeEach(() => {
    objectUrlCount = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      objectUrlCount += 1
      return `blob:http://localhost/preview-${objectUrlCount}`
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    extractSubscriptionScreenshotMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders empty state and returns to source on Back', async () => {
    const user = userEvent.setup()
    renderUpload({ from: '/subscriptions' })

    expect(screen.getByRole('heading', { name: '扫描截图' })).toBeInTheDocument()
    expect(screen.getByLabelText('选择截图')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '返回' }))

    expect(screen.getByRole('heading', { name: '记录' })).toBeInTheDocument()
  })

  it('creates, replaces, removes, and revokes temporary Object URLs', async () => {
    const user = userEvent.setup()
    const { unmount } = renderUpload()
    const input = screen.getByLabelText('选择截图')

    await user.upload(input, imageFile('first.png'))

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(screen.getByText('first.png')).toBeInTheDocument()
    expect(screen.getByAltText('已选择截图预览')).toHaveAttribute(
      'src',
      'blob:http://localhost/preview-1',
    )

    await user.upload(input, imageFile('second.png'))

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/preview-1')
    expect(screen.getByText('second.png')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '移除图片' }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/preview-2')
    expect(screen.getByText('上传一张截图')).toBeInTheDocument()

    await user.upload(input, imageFile('third.png'))
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/preview-3')
  })

  it('handles invalid files and picker cancel without entering analysis or leaking preview URLs', async () => {
    const user = userEvent.setup()
    renderUpload()
    const input = screen.getByLabelText('选择截图')

    await user.upload(input, imageFile('bad.pdf', 'application/pdf'))

    expect(screen.getByText(/PNG、JPEG 或 WebP/)).toBeInTheDocument()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(screen.queryByText(/正在分析截图/)).not.toBeInTheDocument()

    await user.upload(input, [])
    expect(screen.getByText(/PNG、JPEG 或 WebP/)).toBeInTheDocument()
  })

  it('handles endpoint failure, preserves preview, retries, and cancels analysis', async () => {
    const user = userEvent.setup()
    const firstAnalysis = deferred<unknown>()
    extractSubscriptionScreenshotMock
      .mockReturnValueOnce(firstAnalysis.promise)
      .mockReturnValueOnce(new Promise(() => undefined))
    renderUpload()
    await user.upload(screen.getByLabelText('选择截图'), imageFile())

    await user.click(screen.getByRole('button', { name: '开始分析' }))
    expect(screen.getByText(/正在分析截图/)).toBeInTheDocument()

    firstAnalysis.resolve({
      ok: false,
      error: { code: 'PROVIDER_ERROR', message: 'raw provider body' },
    })
    await waitFor(() => expect(screen.getByText(/AI 分析失败，请稍后重试/)).toBeInTheDocument())
    expect(screen.queryByText(/raw provider body/)).not.toBeInTheDocument()
    expect(screen.getByAltText('已选择截图预览')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(screen.getByText(/正在分析截图/)).toBeInTheDocument()
    expect(extractSubscriptionScreenshotMock).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: '取消分析' }))
    expect(screen.getByRole('button', { name: '开始分析' })).toBeInTheDocument()
  })

  it('prevents double submit while analysis is in progress', async () => {
    const user = userEvent.setup()
    extractSubscriptionScreenshotMock.mockReturnValue(new Promise(() => undefined))
    renderUpload()
    await user.upload(screen.getByLabelText('选择截图'), imageFile())

    const startButton = screen.getByRole('button', { name: '开始分析' })
    await user.click(startButton)
    await user.click(startButton)

    expect(screen.getByText(/正在分析截图/)).toBeInTheDocument()
    expect(startButton).toBeDisabled()
    expect(extractSubscriptionScreenshotMock).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['AI_NOT_CONFIGURED', 'AI 分析暂不可用。'],
    ['PROVIDER_TIMEOUT', '分析时间过长，请重试。'],
    ['MODEL_OUTPUT_INVALID', '无法可靠读取这张截图，请重试或手动添加。'],
  ])('maps %s to a stable user message', async (code, message) => {
    const user = userEvent.setup()
    extractSubscriptionScreenshotMock.mockResolvedValueOnce({
      ok: false,
      error: { code, message: 'raw server detail' },
    })
    renderUpload()
    await user.upload(screen.getByLabelText('选择截图'), imageFile())

    await user.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument())
    expect(screen.queryByText(/raw server detail/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '核对识别结果' })).not.toBeInTheDocument()
    expect(screen.getByAltText('已选择截图预览')).toBeInTheDocument()
  })

  it('renders timeout, preview lost, and unsupported modal recovery states', async () => {
    const user = userEvent.setup()
    renderUpload({ initialCaptureState: 'timeout' })

    expect(screen.getByText(/分析超时/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '手动录入' }))
    await user.click(screen.getByRole('button', { name: '添加付费会员' }))
    expect(screen.getByRole('heading', { name: '添加付费会员' })).toBeInTheDocument()

    renderUpload({ initialCaptureState: 'preview_lost' })
    expect(screen.getByText(/临时预览已不可用/)).toBeInTheDocument()

    renderUpload({ initialCaptureState: 'unsupported' })
    expect(screen.getByRole('dialog', { name: '不支持的截图' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重新选择' }))
    expect(screen.queryByRole('dialog', { name: '不支持的截图' })).not.toBeInTheDocument()
  })

  it('lets Escape dismiss the unsupported screenshot modal', async () => {
    const user = userEvent.setup()
    renderUpload({ initialCaptureState: 'unsupported' })

    expect(screen.getByRole('dialog', { name: '不支持的截图' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: '不支持的截图' })).not.toBeInTheDocument()
  })

  it('does not write image data, create records, navigate to Review, or create extracted fields', async () => {
    const user = userEvent.setup()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    extractSubscriptionScreenshotMock.mockResolvedValueOnce({
      ok: false,
      error: { code: 'PROVIDER_ERROR', message: 'failure' },
    })
    renderUpload()

    await user.upload(screen.getByLabelText('选择截图'), imageFile())
    await user.click(screen.getByRole('button', { name: '开始分析' }))
    await waitFor(() => expect(screen.getByText(/AI 分析失败，请稍后重试/)).toBeInTheDocument())

    expect(setItemSpy).not.toHaveBeenCalled()
    expect(screen.queryByText(/核对识别结果/)).not.toBeInTheDocument()
    expect(screen.queryByText(/来源文本/)).not.toBeInTheDocument()
    expect(screen.queryByText(/AI is/i)).not.toBeInTheDocument()
  })
})
