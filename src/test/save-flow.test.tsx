import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFixtureCaptureDraft } from '../fixtures/membershipFixture'
import { summarizeEvidence } from '../presentation/subscriptionPresentation'
import ReviewExtractedDetails from '../pages/ReviewExtractedDetails'
import SubscriptionDetail from '../pages/SubscriptionDetail'
import { SubscriptionProvider } from '../store/SubscriptionProvider'
import type { CaptureSessionDraft } from '../types/capture'
import type { FieldEvidence } from '../types/evidence'
import type { StorageEnvelope, SubscriptionRecord } from '../types'

function draft() {
  return createFixtureCaptureDraft({
    file: new File([new Uint8Array([1])], 'subclear-membership-demo.png', { type: 'image/png' }),
    capturedAt: '2026-07-15T00:00:00.000Z',
    sessionId: 'save_flow_test',
  })
}

function renderAiAddForm(captureDraft = draft()) {
  return render(
    <SubscriptionProvider>
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/review-extracted',
            state: { draft: captureDraft },
          },
        ]}
      >
        <Routes>
          <Route path="/review-extracted" element={<ReviewExtractedDetails />} />
          <Route path="/subscription/:id" element={<SubscriptionDetail />} />
          <Route path="/scan-screenshot" element={<h1>扫描截图</h1>} />
        </Routes>
      </MemoryRouter>
    </SubscriptionProvider>,
  )
}

function withEvidenceField(field: FieldEvidence): CaptureSessionDraft {
  const base = draft()
  const reviewFields = [...base.review_fields, field]
  return {
    ...base,
    review_fields: reviewFields,
    draft_record: base.draft_record
      ? {
          ...base.draft_record,
          evidence_records: base.draft_record.evidence_records.map((record) => ({
            ...record,
            extracted_fields: reviewFields,
          })),
        }
      : base.draft_record,
  }
}

function evidenceField(overrides: Partial<FieldEvidence> & Pick<FieldEvidence, 'field_name'>): FieldEvidence {
  return {
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

function draftWithEvidenceFields(fields: FieldEvidence[]): CaptureSessionDraft {
  const base = draft()
  return {
    ...base,
    review_fields: fields,
    draft_record: base.draft_record
      ? {
          ...base.draft_record,
          service_name: '',
          plan_name: null,
          platform: null,
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
  }
}

describe('AI-prefilled add form save flow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('does not save AI candidates until the user submits the form', () => {
    localStorage.setItem('subclear_subscriptions', JSON.stringify({ schema_version: 1, records: [] }))
    renderAiAddForm()

    expect(screen.getByRole('heading', { name: '添加订阅' })).toBeInTheDocument()
    expect(screen.getByLabelText('服务名称')).toHaveValue('Aurora Plus')
    expect(localStorage.getItem('subclear_subscriptions')).not.toContain('Aurora Plus')
    expect(screen.queryByRole('dialog', { name: /保存不完整记录/ })).not.toBeInTheDocument()
  })

  it('saves the edited form values through the shared canonical record builder', async () => {
    const user = userEvent.setup()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-1111-4111-8111-111111111111')
    localStorage.setItem('subclear_subscriptions', JSON.stringify({ schema_version: 1, records: [] }))
    renderAiAddForm()

    await user.click(screen.getByRole('button', { name: '使用 ¥30' }))
    await user.click(screen.getByRole('button', { name: '确认并保存' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Aurora Plus' })).toBeInTheDocument())
    const envelope = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as StorageEnvelope
    const saved = envelope.records.find(
      (record: SubscriptionRecord) => record.facts.id === 'sub_11111111-1111-4111-8111-111111111111',
    )
    expect(saved?.facts).toMatchObject({
      service_name: 'Aurora Plus',
      plan_name: 'Premium Monthly',
      entitlement_type: 'paid_membership',
      membership_end_date: '2026-08-30',
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-08-30',
      renewal_price: 30,
      currency: 'CNY',
      billing_cycle: 'monthly',
    })
    const serviceEvidence = saved?.facts.evidence_records[0].extracted_fields.find(
      (field) => field.field_name === 'service_name',
    )
    expect(serviceEvidence).toMatchObject({
      evidence_type: 'direct',
      review_status: 'confirmed',
      user_confirmed: true,
    })
    const priceEvidence = saved?.facts.evidence_records[0].extracted_fields.find(
      (field) => field.field_name === 'renewal_price',
    )
    expect(priceEvidence).toMatchObject({
      extracted_value: 30,
      evidence_type: 'user_edited',
      review_status: 'confirmed',
      user_confirmed: true,
    })
    expect(JSON.stringify(saved)).not.toMatch(/base64|data:image|object_url/i)
  })

  it('does not leave saved AI evidence as an unresolved user task', async () => {
    const user = userEvent.setup()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('33333333-3333-4333-8333-333333333333')
    localStorage.setItem('subclear_subscriptions', JSON.stringify({ schema_version: 1, records: [] }))
    renderAiAddForm()

    await user.click(screen.getByRole('button', { name: '确认并保存' }))

    const envelope = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as StorageEnvelope
    const saved = envelope.records.find(
      (record: SubscriptionRecord) => record.facts.id === 'sub_33333333-3333-4333-8333-333333333333',
    )
    expect(saved).toBeDefined()
    expect(summarizeEvidence(saved!).unresolvedFieldCount).toBe(0)
    expect(summarizeEvidence(saved!).needsReview).toBe(false)
  })

  it('turns AI missing evidence into user-edited confirmed evidence when the user fills the field', async () => {
    const user = userEvent.setup()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('44444444-4444-4444-8444-444444444444')
    localStorage.setItem('subclear_subscriptions', JSON.stringify({ schema_version: 1, records: [] }))
    renderAiAddForm(withEvidenceField({
      field_name: 'platform',
      extracted_value: null,
      source_text: null,
      evidence_type: 'missing',
      review_status: 'missing',
      is_inferred: false,
      user_confirmed: false,
      confirmed_at: null,
    }))

    await user.selectOptions(screen.getByLabelText('订阅渠道'), 'App Store')
    await user.click(screen.getByRole('button', { name: '确认并保存' }))

    const envelope = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as StorageEnvelope
    const saved = envelope.records.find(
      (record: SubscriptionRecord) => record.facts.id === 'sub_44444444-4444-4444-8444-444444444444',
    )
    const platformEvidence = saved?.facts.evidence_records[0].extracted_fields.find(
      (field) => field.field_name === 'platform',
    )
    expect(saved?.facts.platform).toBe('App Store')
    expect(platformEvidence).toMatchObject({
      extracted_value: 'App Store',
      evidence_type: 'user_edited',
      review_status: 'confirmed',
      user_confirmed: true,
    })
  })

  it('preserves the Apple Music canonical facts after AI-assisted save', async () => {
    const user = userEvent.setup()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('55555555-5555-4555-8555-555555555555')
    localStorage.setItem('subclear_subscriptions', JSON.stringify({ schema_version: 1, records: [] }))
    renderAiAddForm(draftWithEvidenceFields([
      evidenceField({
        field_name: 'service_name',
        extracted_value: 'Apple Music',
        source_text: 'Apple Music',
        evidence_type: 'direct',
        review_status: 'ready',
      }),
      evidenceField({
        field_name: 'plan_name',
        extracted_value: '个人',
        source_text: '个人',
        evidence_type: 'direct',
        review_status: 'ready',
      }),
      evidenceField({
        field_name: 'platform',
        extracted_value: 'App Store',
        source_text: 'App Store',
        evidence_type: 'direct',
        review_status: 'ready',
      }),
      evidenceField({
        field_name: 'membership_start_date',
        extracted_value: null,
        evidence_type: 'missing',
        review_status: 'missing',
      }),
      evidenceField({
        field_name: 'membership_end_date',
        extracted_value: null,
        evidence_type: 'missing',
        review_status: 'missing',
      }),
      evidenceField({
        field_name: 'renewal_status',
        extracted_value: 'auto_renew_on',
        source_text: '自动续费',
        evidence_type: 'direct',
        review_status: 'ready',
      }),
      evidenceField({
        field_name: 'next_charge_date',
        extracted_value: '2026-09-01',
        source_text: '2026-09-01',
        evidence_type: 'direct',
        review_status: 'ready',
      }),
      evidenceField({
        field_name: 'renewal_price',
        extracted_value: 12,
        source_text: 'CNY 12.00',
        evidence_type: 'direct',
        review_status: 'ready',
      }),
      evidenceField({
        field_name: 'currency',
        extracted_value: 'CNY',
        source_text: 'CNY',
        evidence_type: 'direct',
        review_status: 'ready',
      }),
      evidenceField({
        field_name: 'billing_cycle',
        extracted_value: 'monthly',
        source_text: '每月',
        evidence_type: 'direct',
        review_status: 'ready',
      }),
    ]))

    await user.click(screen.getByRole('button', { name: '确认并保存' }))

    const envelope = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as StorageEnvelope
    const saved = envelope.records.find(
      (record: SubscriptionRecord) => record.facts.id === 'sub_55555555-5555-4555-8555-555555555555',
    )
    expect(saved?.facts).toMatchObject({
      service_name: 'Apple Music',
      plan_name: '个人',
      platform: 'App Store',
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-09-01',
      renewal_price: 12,
      currency: 'CNY',
      billing_cycle: 'monthly',
      membership_start_date: null,
      membership_end_date: null,
    })
    expect(summarizeEvidence(saved!).unresolvedFieldCount).toBe(0)
  })

  it('shows shared validation errors and keeps the user on the AI form when required input is invalid', async () => {
    const user = userEvent.setup()
    localStorage.setItem('subclear_subscriptions', JSON.stringify({ schema_version: 1, records: [] }))
    renderAiAddForm()

    await user.clear(screen.getByLabelText('服务名称'))
    await user.click(screen.getByRole('button', { name: '确认并保存' }))

    expect(screen.getByText('服务名称为必填项。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '添加订阅' })).toBeInTheDocument()
    expect(localStorage.getItem('subclear_subscriptions')).not.toContain('Aurora Plus')
  })

  it('reports storage failure without claiming success', async () => {
    const user = userEvent.setup()
    localStorage.setItem('subclear_subscriptions', JSON.stringify({ schema_version: 999, records: [] }))
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('22222222-2222-4222-8222-222222222222')
    renderAiAddForm()

    await user.click(screen.getByRole('button', { name: '确认并保存' }))

    await waitFor(() =>
      expect(screen.getByText(/当前无法保存/)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/saved successfully|subscription created/i)).not.toBeInTheDocument()
  })
})
