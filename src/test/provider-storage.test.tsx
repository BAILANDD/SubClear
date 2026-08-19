import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SubscriptionProvider } from '../store/SubscriptionProvider'
import { useSubscriptions } from '../store/useSubscriptions'
import { CURRENT_SCHEMA_VERSION, type SubscriptionRecord } from '../types'

const SAVED_AT = '2026-07-15T01:00:00.000Z'

function StorageProbe() {
  const { subscriptions, addSubscriptionRecord } = useSubscriptions()
  const first = subscriptions[0]

  return (
    <div>
      <p>Count: {subscriptions.length}</p>
      <p>First: {first?.service_name}</p>
      <button
        type="button"
        onClick={() =>
          addSubscriptionRecord({
            facts: {
              id: 'ai_saved_001',
              service_name: 'Aurora Plus',
              plan_name: null,
              category: null,
              platform: null,
              entitlement_type: 'paid_membership',
              membership_start_date: null,
              membership_end_date: null,
              renewal_status: 'unknown',
              next_charge_date: null,
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
              evidence_records: [],
              schema_version: CURRENT_SCHEMA_VERSION,
              created_at: SAVED_AT,
              updated_at: SAVED_AT,
            },
          })
        }
      >
        Save AI Record
      </button>
    </div>
  )
}

describe('SubscriptionProvider canonical storage activation', () => {
  it('loads legacy UI projection and persists a current envelope after adding a SubscriptionRecord', async () => {
    const user = userEvent.setup()
    localStorage.clear()

    render(
      <SubscriptionProvider>
        <StorageProbe />
      </SubscriptionProvider>,
    )

    expect(screen.getByText(/First: Notion Pro/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /save ai record/i }))

    expect(screen.getByText(/Count: 8/)).toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem('subclear_subscriptions') ?? '{}') as {
      schema_version?: number
      records?: SubscriptionRecord[]
    }
    expect(stored.schema_version).toBe(CURRENT_SCHEMA_VERSION)
    expect(stored.records?.some((record) => record.facts.id === 'ai_saved_001')).toBe(true)
  })

  it('does not dispatch a new SubscriptionRecord when canonical persistence fails', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'subclear_subscriptions',
      JSON.stringify({
        schema_version: CURRENT_SCHEMA_VERSION,
        records: [],
      }),
    )

    render(
      <SubscriptionProvider>
        <StorageProbe />
      </SubscriptionProvider>,
    )

    expect(screen.getByText(/Count: 0/)).toBeInTheDocument()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    await user.click(screen.getByRole('button', { name: /save ai record/i }))

    expect(screen.getByText(/Count: 0/)).toBeInTheDocument()
    setItemSpy.mockRestore()
  })
})
