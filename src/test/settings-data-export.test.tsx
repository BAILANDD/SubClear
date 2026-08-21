import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import {
  CURRENT_SCHEMA_VERSION,
  type EvidenceRecord,
  type SubscriptionFacts,
  type SubscriptionRecord,
} from '../types'

const CREATED_AT = '2026-07-01T00:00:00.000Z'

function evidence(): EvidenceRecord {
  return {
    evidence_id: 'evidence_001',
    source_type: 'in_app_membership',
    file_name: 'membership.png',
    fixture_reference: '/fixtures/subclear-membership-demo.png',
    extraction_method: 'fixture',
    processing_status: 'completed',
    created_at: CREATED_AT,
    extracted_fields: [],
  }
}

function record(overrides: Partial<SubscriptionFacts> = {}): SubscriptionRecord {
  return {
    facts: {
      id: 'record_001',
      service_name: 'Aurora Plus',
      plan_name: null,
      category: null,
      platform: null,
      entitlement_type: 'paid_membership',
      membership_start_date: null,
      membership_end_date: '2026-08-30',
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-08-01',
      renewal_price: null,
      currency: null,
      billing_cycle: null,
      cancellation_status: 'none',
      cancellation_path: null,
      cancellation_steps: [],
      cancellation_deadline: null,
      planned_cancel_date: null,
      cancellation_completed_at: null,
      cancellation_proof: null,
      reminder_settings: {
        enabled: true,
        offset_days: 7,
        state: 'enabled',
      },
      evidence_records: [evidence()],
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: CREATED_AT,
      updated_at: CREATED_AT,
      ...overrides,
    },
  }
}

function seed(records: SubscriptionRecord[]) {
  localStorage.setItem(
    'subclear_subscriptions',
    JSON.stringify({
      schema_version: CURRENT_SCHEMA_VERSION,
      records,
    }),
  )
}

describe('Settings / Data canonical export page', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps Settings as one page with export, privacy, and prototype boundary sections', () => {
    seed([record()])
    window.location.hash = '#/settings'

    render(<App />)

    expect(screen.getByRole('heading', { name: '设置 / 数据' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '数据导出' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '隐私' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '原型边界' })).toBeInTheDocument()
    expect(screen.getByText(/截图上传由用户主动发起/)).toBeInTheDocument()
    expect(screen.getByText(/不会自动扫描你的相册/)).toBeInTheDocument()
    expect(screen.getByText(/不会自动读取短信或邮件/)).toBeInTheDocument()
    expect(screen.getByText(/仅在当前会话中临时存在/)).toBeInTheDocument()
    expect(screen.getByText(/原始截图不会存入 localStorage/)).toBeInTheDocument()
    expect(screen.getAllByText(/原始截图不会包含在导出文件中/).length).toBeGreaterThan(0)
    expect(screen.getByText(/服务端 Gemini multimodal extraction/)).toBeInTheDocument()
    expect(screen.getByText(/AI 结果会进入可编辑的共享表单/)).toBeInTheDocument()
    expect(screen.getByText(/只有用户确认保存后才写入记录/)).toBeInTheDocument()
    expect(screen.getByText(/不声明生产级截图鲁棒性/)).toBeInTheDocument()
    expect(screen.getByText(/专用生产 OCR pipeline/)).toBeInTheDocument()
    expect(screen.getByText(/AI 不会自动保存/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/model selector/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/chat settings/i)).not.toBeInTheDocument()
  })

  it('downloads canonical JSON export and cleans up object URLs without mutating records', async () => {
    const user = userEvent.setup()
    seed([record()])
    window.location.hash = '#/settings'
    const before = localStorage.getItem('subclear_subscriptions')
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export-url')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    render(<App />)
    await user.click(screen.getByRole('button', { name: '导出 JSON' }))

    expect(await screen.findByText(/JSON 导出成功/)).toBeInTheDocument()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export-url')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('subclear_subscriptions')).toBe(before)
  })

  it('shows retryable export failure without mutating canonical data', async () => {
    const user = userEvent.setup()
    seed([record()])
    window.location.hash = '#/settings'
    const before = localStorage.getItem('subclear_subscriptions')
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementationOnce(() => {
        throw new Error('download unavailable')
      })
      .mockReturnValue('blob:retry-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    render(<App />)
    await user.click(screen.getByRole('button', { name: '导出 CSV' }))

    expect(await screen.findByText(/导出失败/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试 CSV 导出' })).toBeInTheDocument()
    expect(localStorage.getItem('subclear_subscriptions')).toBe(before)

    await user.click(screen.getByRole('button', { name: '重试 CSV 导出' }))

    await waitFor(() => expect(screen.getByText(/CSV 导出成功/)).toBeInTheDocument())
    expect(createObjectURL).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem('subclear_subscriptions')).toBe(before)
  })
})
