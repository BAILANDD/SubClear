import { describe, expect, it } from 'vitest'
import {
  assertExportSafe,
  buildCSVExport,
  buildJSONExport,
  CSV_EXPORT_HEADERS,
} from '../utils/export'
import {
  CURRENT_SCHEMA_VERSION,
  type EvidenceRecord,
  type SubscriptionFacts,
  type SubscriptionRecord,
} from '../types'

const CREATED_AT = '2026-07-01T00:00:00.000Z'
const GENERATED_AT = '2026-07-15T10:00:00.000Z'
const REFERENCE_DATE = '2026-07-15'

function evidence(): EvidenceRecord {
  return {
    evidence_id: 'evidence_001',
    source_type: 'in_app_membership',
    file_name: 'membership.png',
    fixture_reference: '/fixtures/subclear-membership-demo.png',
    extraction_method: 'fixture',
    processing_status: 'completed',
    created_at: CREATED_AT,
    extracted_fields: [
      {
        field_name: 'renewal_price',
        extracted_value: {
          candidates: ['28', '30'],
          currency: 'CNY',
        },
        source_text: 'Plan page says ¥28, receipt says ¥30',
        evidence_type: 'conflict',
        review_status: 'conflict',
        is_inferred: false,
        user_confirmed: false,
        confirmed_at: null,
      },
    ],
  }
}

function record(overrides: Partial<SubscriptionFacts> = {}): SubscriptionRecord {
  return {
    facts: {
      id: 'record_001',
      service_name: 'Comma, Quote "Service"',
      plan_name: null,
      category: null,
      platform: null,
      entitlement_type: 'paid_membership',
      membership_start_date: null,
      membership_end_date: '2026-08-30',
      renewal_status: 'auto_renew_on',
      next_charge_date: '2026-08-01',
      renewal_price: null,
      currency: 'CNY',
      billing_cycle: 'monthly',
      cancellation_status: 'planned',
      cancellation_path: 'Settings > Membership',
      cancellation_steps: ['Open settings', 'Choose "Cancel"', 'Confirm\nDone'],
      cancellation_deadline: '2026-07-31',
      planned_cancel_date: '2026-07-20',
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
    metadata: {
      migrated_at: '2026-07-10T00:00:00.000Z',
    },
  }
}

describe('canonical export contract', () => {
  it('builds stable CSV from canonical Subscription Facts without derived or evidence candidate values', () => {
    const csv = buildCSVExport([record()])
    const [header, row] = csv.replace(/^\uFEFF/, '').split('\n')

    expect(header).toBe(CSV_EXPORT_HEADERS.join(','))
    expect(header).not.toContain('membership_status')
    expect(header).not.toContain('remaining_days')
    expect(header).not.toContain('needs_review')
    expect(header).not.toContain('dashboard')
    expect(header).not.toContain('renewal_date')
    expect(header).not.toContain('trial_end_date')
    expect(row).toContain('"Comma, Quote ""Service"""')
    expect(row).toContain('auto_renew_on')
    expect(row).toContain('planned')
    expect(row).toContain('"[""Open settings"",""Choose \\""Cancel\\"""",""Confirm\\nDone""]"')
    expect(row).not.toContain('28')
    expect(row).not.toContain('blob:')
    expect(row).not.toContain('data:image')
  })

  it('builds structured JSON with facts, evidence, storage metadata, and derived snapshot separated', () => {
    const source = record()
    const before = JSON.stringify(source)
    const payload = buildJSONExport([source], {
      generatedAt: GENERATED_AT,
      referenceDate: REFERENCE_DATE,
    })

    expect(payload.export_format).toBe('subclear')
    expect(payload.export_version).toBe(1)
    expect(payload.generated_at).toBe(GENERATED_AT)
    expect(payload.schema_version).toBe(CURRENT_SCHEMA_VERSION)
    expect(payload.records).toHaveLength(1)

    const exported = payload.records[0]
    expect(exported.facts.service_name).toBe('Comma, Quote "Service"')
    expect(exported.facts.renewal_price).toBeNull()
    expect('evidence_records' in exported.facts).toBe(false)
    expect('membership_status' in exported.facts).toBe(false)
    expect('remaining_days' in exported.facts).toBe(false)

    expect(exported.evidence[0]?.fixture_reference).toBe('/fixtures/subclear-membership-demo.png')
    expect(exported.evidence[0]?.file_name).toBe('membership.png')
    expect(exported.evidence[0]?.extracted_fields[0]?.extracted_value).toEqual({
      candidates: ['28', '30'],
      currency: 'CNY',
    })
    expect(exported.evidence[0]?.extracted_fields[0]?.review_status).toBe('conflict')
    expect('model_confidence' in (exported.evidence[0]?.extracted_fields[0] ?? {})).toBe(false)

    expect(exported.storage_metadata).toEqual({ migrated_at: '2026-07-10T00:00:00.000Z' })
    expect(exported.derived_snapshot).toEqual({
      generated_at: GENERATED_AT,
      reference_date: REFERENCE_DATE,
      derived_at_export_time: true,
      membership_status: 'active',
      remaining_days: 46,
    })
    expect(JSON.stringify(source)).toBe(before)
  })

  it('rejects raw image and temporary preview data from export payloads', () => {
    expect(() => assertExportSafe({ ok: '/fixtures/subclear-membership-demo.png' })).not.toThrow()
    expect(() => assertExportSafe({ preview_url: 'blob:https://local/preview' })).toThrow(/unsafe/i)
    expect(() => assertExportSafe({ raw_image: 'data:image/png;base64,abc' })).toThrow(/unsafe/i)
    expect(() => assertExportSafe({ file: new File(['x'], 'screen.png', { type: 'image/png' }) })).toThrow(
      /unsafe/i,
    )
    expect(() => assertExportSafe({ blob: new Blob(['x'], { type: 'image/png' }) })).toThrow(/unsafe/i)
  })
})
