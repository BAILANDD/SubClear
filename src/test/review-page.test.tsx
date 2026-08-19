import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { createFixtureCaptureDraft } from '../fixtures/membershipFixture'
import ReviewExtractedDetails from '../pages/ReviewExtractedDetails'
import ScreenshotUpload from '../pages/ScreenshotUpload'
import { SubscriptionProvider } from '../store/SubscriptionProvider'
import type { AiExtractionField, AiSubscriptionExtraction } from '../ai/extractionTypes'
import type { CaptureSessionDraft } from '../types/capture'
import type { FieldEvidence, SubscriptionFactFieldName } from '../types/evidence'
import type { StorageEnvelope, SubscriptionRecord } from '../types'

const { extractSubscriptionScreenshotMock } = vi.hoisted(() => ({
  extractSubscriptionScreenshotMock: vi.fn(),
}))

vi.mock('../ai/extractionClient', () => ({
  extractSubscriptionScreenshot: extractSubscriptionScreenshotMock,
}))

function fixtureDraft() {
  return createFixtureCaptureDraft({
    file: new File([new Uint8Array([1])], 'subclear-membership-demo.png', { type: 'image/png' }),
    capturedAt: '2026-07-15T00:00:00.000Z',
    sessionId: 'review_page_test',
  })
}

function fieldEvidence(
  fieldName: SubscriptionFactFieldName,
  overrides: Partial<FieldEvidence> = {},
): FieldEvidence {
  return {
    field_name: fieldName,
    extracted_value: null,
    source_text: null,
    evidence_type: 'missing',
    review_status: 'missing',
    is_inferred: false,
    user_confirmed: false,
    confirmed_at: null,
    ...overrides,
  }
}

function draftWithFields(fields: FieldEvidence[]): CaptureSessionDraft {
  const base = fixtureDraft()
  return {
    ...base,
    draft_record: base.draft_record
      ? {
          ...base.draft_record,
          service_name: '',
          plan_name: null,
          membership_start_date: null,
          membership_end_date: null,
          renewal_status: 'unknown',
          next_charge_date: null,
          renewal_price: null,
          currency: null,
          billing_cycle: null,
          cancellation_path: null,
          evidence_records: base.draft_record.evidence_records.map((record) => ({
            ...record,
            extracted_fields: fields,
          })),
        }
      : base.draft_record,
    review_fields: fields,
  }
}

function draftWithAiMeta(): CaptureSessionDraft {
  const base = fixtureDraft()
  return {
    ...base,
    ai_extraction: {
      extraction: typedAiExtractionFixture(),
      issues: [],
      meta: {
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite',
        requestId: 'req_hidden_123',
        latencyMs: 1200,
      },
    },
  }
}

function aiField<T extends string | number>(value: T | null): AiExtractionField<T> {
  return {
    value,
    evidence_type: value === null ? 'missing' : 'direct',
    review_status: value === null ? 'missing' : 'ready',
    source_text: value === null ? null : String(value),
    is_inferred: false,
  }
}

function typedAiExtractionFixture(): AiSubscriptionExtraction {
  return {
    schema_version: '1.0',
    fields: {
      service_name: aiField('Aurora Plus'),
      plan_name: aiField('Premium Monthly'),
      category: aiField<string>(null),
      platform: aiField<string>(null),
      membership_start_date: aiField<string>(null),
      membership_end_date: aiField('2026-08-30'),
      renewal_status: aiField('auto_renew_on'),
      next_charge_date: aiField('2026-08-30'),
      price_amount: aiField(28),
      currency: aiField('CNY'),
      billing_period: aiField('monthly'),
      cancellation_path: aiField<string>(null),
    },
  }
}

function renderReview(state: Record<string, unknown> = { draft: fixtureDraft() }) {
  return render(
    <SubscriptionProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/review-extracted',
            state,
          },
        ]}
      >
        <Routes>
          <Route path="/review-extracted" element={<ReviewExtractedDetails />} />
          <Route path="/scan-screenshot" element={<h1>扫描截图</h1>} />
          <Route path="/add-trial" element={<h1>添加免费试用</h1>} />
          <Route path="/subscription/:id" element={<h1>已保存详情</h1>} />
        </Routes>
      </MemoryRouter>
    </SubscriptionProvider>,
  )
}

function fixtureUploadFile(): File {
  return new File([new Uint8Array([1, 2, 3, 4])], 'subclear-membership-demo.png', {
    type: 'image/png',
  })
}

function aiExtractionSuccess() {
  return {
    ok: true,
    data: {
      extraction: {
        schema_version: '1.0',
        fields: {
          service_name: { value: 'Aurora Plus' },
          plan_name: { value: 'Premium Monthly' },
          membership_end_date: { value: '2026-08-30' },
          renewal_status: { value: 'auto_renew_on' },
          next_charge_date: { value: '2026-08-30' },
          renewal_price: { value: 28 },
          currency: { value: 'CNY' },
          billing_cycle: { value: 'monthly' },
        },
      },
      fields: [
        fieldEvidence('service_name', {
          extracted_value: 'Aurora Plus',
          source_text: 'Aurora Plus',
          evidence_type: 'direct',
          review_status: 'ready',
        }),
        fieldEvidence('plan_name', {
          extracted_value: 'Premium Monthly',
          source_text: 'Premium Monthly',
          evidence_type: 'direct',
          review_status: 'ready',
        }),
        fieldEvidence('membership_end_date', {
          extracted_value: '2026-08-30',
          source_text: 'Membership valid until Aug 30, 2026',
          evidence_type: 'direct',
          review_status: 'ready',
        }),
        fieldEvidence('renewal_status', {
          extracted_value: 'auto_renew_on',
          source_text: 'Renews automatically unless cancelled',
          evidence_type: 'inferred',
          review_status: 'needs_review',
          is_inferred: true,
        }),
        fieldEvidence('next_charge_date', {
          extracted_value: '2026-08-30',
          source_text: 'Next charge 2026-08-30',
          evidence_type: 'direct',
          review_status: 'ready',
        }),
        fieldEvidence('renewal_price', {
          extracted_value: 28,
          source_text: '¥28 / month',
          evidence_type: 'direct',
          review_status: 'ready',
        }),
        fieldEvidence('currency', {
          extracted_value: 'CNY',
          source_text: '¥28 / month',
          evidence_type: 'direct',
          review_status: 'ready',
        }),
        fieldEvidence('billing_cycle', {
          extracted_value: 'monthly',
          source_text: 'Premium Monthly',
          evidence_type: 'direct',
          review_status: 'ready',
        }),
      ],
      issues: [],
    },
    meta: {
      provider: 'gemini',
      model: 'gemini-3.5-flash-lite',
      requestId: 'req_123',
      latencyMs: 1234,
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('Review Extracted Details', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders AI extraction as a prefilled add form instead of review cards', () => {
    renderReview()

    expect(screen.getByRole('heading', { name: '添加订阅' })).toBeInTheDocument()
    expect(screen.getByLabelText('服务名称')).toHaveValue('Aurora Plus')
    expect(screen.getByLabelText('套餐名称')).toHaveValue('Premium Monthly')
    expect(screen.getByLabelText('续费方式')).toHaveValue('auto_renew_on')
    expect(screen.getByLabelText('会员到期')).toHaveValue('2026-08-30')
    expect(screen.getByLabelText('下次自动扣费日期')).toHaveValue('2026-08-30')
    expect(screen.getByLabelText('续费金额')).toHaveValue(28)
    expect(screen.getByLabelText('币种')).toHaveValue('CNY')
    expect(screen.getByLabelText('计费周期')).toHaveValue('monthly')
    expect(screen.queryByText('证据类型')).not.toBeInTheDocument()
    expect(screen.queryByText('核对状态')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确认服务名称' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '清空服务名称' })).not.toBeInTheDocument()
  })

  it('turns an AI price conflict into a field-level price hint', async () => {
    const user = userEvent.setup()
    renderReview()

    expect(screen.getByText(/截图中存在不同价格/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '使用 ¥30' })).toBeInTheDocument()
    expect(screen.queryByTestId('field-renewal_price')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '续费价格' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '需要处理' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '使用 ¥30' }))

    expect(screen.getByLabelText('续费金额')).toHaveValue(30)
  })

  it('shows missing AI fields as editable empty form fields without review status UI', () => {
    renderReview({
      draft: draftWithFields([
        fieldEvidence('service_name', {
          extracted_value: 'Aurora Plus',
          source_text: 'Aurora Plus',
          evidence_type: 'direct',
          review_status: 'ready',
        }),
      ]),
    })

    expect(screen.getByRole('heading', { name: '添加订阅' })).toBeInTheDocument()
    expect(screen.getByLabelText('服务名称')).toHaveValue('Aurora Plus')
    expect(screen.getByLabelText('套餐名称')).toHaveValue('')
    expect(screen.getByLabelText('续费方式')).toHaveValue('unknown')
    expect(screen.getByLabelText('会员到期')).toHaveValue('')
    expect(screen.queryByLabelText('下次自动扣费日期')).not.toBeInTheDocument()
    expect(screen.getByLabelText('续费金额')).toHaveValue(null)
    expect(screen.queryByText('缺失')).not.toBeInTheDocument()
    expect(screen.queryByText('需核对')).not.toBeInTheDocument()
  })

  it('saves user-edited AI form values only after the user submits', async () => {
    const user = userEvent.setup()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')
    localStorage.setItem('subclear_subscriptions', JSON.stringify({ schema_version: 1, records: [] }))
    renderReview({ draft: draftWithAiMeta() })

    expect(localStorage.getItem('subclear_subscriptions')).not.toContain('Aurora Plus Edited')

    await user.clear(screen.getByLabelText('服务名称'))
    await user.type(screen.getByLabelText('服务名称'), 'Aurora Plus Edited')
    await user.clear(screen.getByLabelText('续费金额'))
    await user.type(screen.getByLabelText('续费金额'), '30')
    await user.click(screen.getByRole('button', { name: '确认并保存' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: '已保存详情' })).toBeInTheDocument())
    const envelope = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as StorageEnvelope
    const saved = envelope.records.find(
      (record: SubscriptionRecord) => record.facts.id === 'sub_11111111-1111-4111-8111-111111111111',
    )
    expect(saved?.facts).toMatchObject({
      service_name: 'Aurora Plus Edited',
      plan_name: 'Premium Monthly',
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-08-30',
      renewal_price: 30,
      currency: 'CNY',
      billing_cycle: 'monthly',
    })
    expect(saved?.facts.evidence_records[0].extracted_fields).toHaveLength(7)
    expect(JSON.stringify(saved?.facts)).not.toMatch(/gemini-3\.5-flash-lite|req_hidden_123|latencyMs/)
    expect(JSON.stringify(saved)).not.toMatch(/base64|data:image|object_url/i)
  })

  it('fails safely when runtime draft route state is missing', async () => {
    const user = userEvent.setup()
    renderReview({})

    expect(screen.getByText(/没有可用的截图分析结果/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '返回扫描' }))
    expect(screen.getByRole('heading', { name: '扫描截图' })).toBeInTheDocument()
  })
})

describe('fixture capture integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    extractSubscriptionScreenshotMock.mockReset()
  })

  it('routes real AI extraction from Analyze to the AI-prefilled add form without writing storage', async () => {
    const user = userEvent.setup()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/fixture-preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const analysis = deferred<ReturnType<typeof aiExtractionSuccess>>()
    extractSubscriptionScreenshotMock.mockReturnValueOnce(analysis.promise)

    window.location.hash = '#/scan-screenshot'
    render(<App />)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    await user.upload(screen.getByLabelText('选择截图'), fixtureUploadFile())
    await user.click(screen.getByRole('button', { name: '开始分析' }))

    expect(screen.getByText(/正在分析截图/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始分析' })).toBeDisabled()
    analysis.resolve(aiExtractionSuccess())
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '添加订阅' })).toBeInTheDocument(),
    )

    expect(extractSubscriptionScreenshotMock).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('#/review-extracted')
    expect(screen.getByLabelText('服务名称')).toHaveValue('Aurora Plus')
    expect(screen.getByLabelText('套餐名称')).toHaveValue('Premium Monthly')
    expect(screen.getByLabelText('续费金额')).toHaveValue(28)
    expect(screen.queryByText('gemini-3.5-flash-lite')).not.toBeInTheDocument()
    expect(screen.queryByText('req_123')).not.toBeInTheDocument()
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(screen.queryByText(/OCR|model confidence|saved successfully/i)).not.toBeInTheDocument()
  })

  it('keeps non-fixture images on controlled failure', async () => {
    const user = userEvent.setup()
    extractSubscriptionScreenshotMock.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: 'raw server message should not render',
      },
    })
    render(
      <MemoryRouter initialEntries={['/scan-screenshot']}>
        <Routes>
          <Route path="/scan-screenshot" element={<ScreenshotUpload />} />
          <Route path="/review-extracted" element={<ReviewExtractedDetails />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.upload(
      screen.getByLabelText('选择截图'),
      new File([new Uint8Array([1, 2, 3, 4])], 'random.png', { type: 'image/png' }),
    )
    await user.click(screen.getByRole('button', { name: '开始分析' }))

    await waitFor(() => expect(screen.getByText(/AI 分析失败，请稍后重试/)).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: '添加订阅' })).not.toBeInTheDocument()
  })
})
