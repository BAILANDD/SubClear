import { describe, expect, it } from 'vitest'
import {
  AI_EXTRACTION_FIELD_NAMES,
  AI_EXTRACTION_JSON_SCHEMA,
  AI_EXTRACTION_SCHEMA_VERSION,
  validateAiExtraction,
  processAiExtractionResponse,
  processAiExtractionResponseDetailed,
  type AiSubscriptionExtraction,
} from '../ai'

// =========================================================================
// Example Payloads
// =========================================================================

/**
 * Example A: SaaS Billing page (e.g. Notion / Adobe style).
 */
const SAAS_BILLING_EXTRACTION: AiSubscriptionExtraction = {
  schema_version: '1.0',
  fields: {
    service_name: {
      value: 'Notion Plus',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Notion Plus — Billing overview',
      is_inferred: false,
      confidence: 0.98,
    },
    plan_name: {
      value: 'Plus Monthly',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Plan: Plus Monthly',
      is_inferred: false,
      confidence: 0.97,
    },
    category: {
      value: 'Productivity',
      evidence_type: 'inferred',
      review_status: 'needs_review',
      source_text: 'Productivity and collaboration platform',
      is_inferred: true,
      confidence: 0.65,
    },
    platform: {
      value: 'Notion 官网',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Manage your Notion subscription at notion.so',
      is_inferred: false,
      confidence: 0.92,
    },
    membership_start_date: {
      value: '2026-01-15',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Member since Jan 15, 2026',
      is_inferred: false,
      confidence: 0.95,
    },
    membership_end_date: {
      value: null,
      evidence_type: 'missing',
      review_status: 'missing',
      source_text: 'No end date — ongoing subscription',
      is_inferred: false,
    },
    renewal_status: {
      value: 'auto_renew_on',
      evidence_type: 'inferred',
      review_status: 'needs_review',
      source_text: 'Your subscription renews automatically.',
      is_inferred: true,
      confidence: 0.82,
    },
    next_charge_date: {
      value: '2026-09-01',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Next charge: Sep 1, 2026',
      is_inferred: false,
      confidence: 0.96,
    },
    price_amount: {
      value: 10,
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: '$10.00 / month',
      is_inferred: false,
      confidence: 0.99,
    },
    currency: {
      value: 'USD',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: '$10.00',
      is_inferred: false,
      confidence: 0.99,
    },
    billing_period: {
      value: 'monthly',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: '/ month',
      is_inferred: false,
      confidence: 0.97,
    },
    cancellation_path: {
      value: null,
      evidence_type: 'missing',
      review_status: 'missing',
      source_text: 'No cancellation information visible on this page.',
      is_inferred: false,
    },
  },
}

/**
 * Example B: App Store Subscription page.
 */
const APP_STORE_EXTRACTION: AiSubscriptionExtraction = {
  schema_version: '1.0',
  fields: {
    service_name: {
      value: 'Spotify Premium',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Spotify Premium',
      is_inferred: false,
      confidence: 0.99,
    },
    plan_name: {
      value: 'Individual',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Individual Plan',
      is_inferred: false,
      confidence: 0.95,
    },
    category: {
      value: 'Music',
      evidence_type: 'inferred',
      review_status: 'needs_review',
      source_text: 'Music streaming service',
      is_inferred: true,
      confidence: 0.7,
    },
    platform: {
      value: 'App Store',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Subscriptions — App Store',
      is_inferred: false,
      confidence: 0.98,
    },
    membership_start_date: {
      value: '2025-06-01',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Subscribed since June 2025',
      is_inferred: false,
      confidence: 0.9,
    },
    membership_end_date: {
      value: null,
      evidence_type: 'missing',
      review_status: 'missing',
      source_text: null,
      is_inferred: false,
    },
    renewal_status: {
      value: 'auto_renew_on',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Renews automatically',
      is_inferred: false,
      confidence: 0.97,
    },
    next_charge_date: {
      value: '2026-09-08',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Next billing date: 8 Sep 2026',
      is_inferred: false,
      confidence: 0.94,
    },
    price_amount: {
      value: 10.99,
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: '$10.99/month',
      is_inferred: false,
      confidence: 0.99,
    },
    currency: {
      value: 'USD',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: '$10.99',
      is_inferred: false,
      confidence: 0.99,
    },
    billing_period: {
      value: 'monthly',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: '/month',
      is_inferred: false,
      confidence: 0.98,
    },
    cancellation_path: {
      value: 'Settings > Apple ID > Subscriptions',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Manage subscription in App Store settings',
      is_inferred: false,
      confidence: 0.91,
    },
  },
}

/**
 * Example C: Free Trial page.
 */
const FREE_TRIAL_EXTRACTION: AiSubscriptionExtraction = {
  schema_version: '1.0',
  fields: {
    service_name: {
      value: 'Figma Professional',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Figma Professional — Free Trial',
      is_inferred: false,
      confidence: 0.99,
    },
    plan_name: {
      value: 'Professional',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Professional plan (trial)',
      is_inferred: false,
      confidence: 0.96,
    },
    category: {
      value: 'Design',
      evidence_type: 'inferred',
      review_status: 'needs_review',
      source_text: 'Design and prototyping tool',
      is_inferred: true,
      confidence: 0.68,
    },
    platform: {
      value: 'Figma 官网',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Manage billing at figma.com',
      is_inferred: false,
      confidence: 0.93,
    },
    membership_start_date: {
      value: '2026-08-01',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Trial started Aug 1, 2026',
      is_inferred: false,
      confidence: 0.95,
    },
    membership_end_date: {
      value: '2026-08-15',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: 'Trial ends Aug 15, 2026',
      is_inferred: false,
      confidence: 0.97,
    },
    renewal_status: {
      value: 'auto_renew_on',
      evidence_type: 'inferred',
      review_status: 'needs_review',
      source_text: 'Will convert to paid plan after trial',
      is_inferred: true,
      confidence: 0.78,
    },
    next_charge_date: {
      value: '2026-08-15',
      evidence_type: 'inferred',
      review_status: 'needs_review',
      source_text: 'First charge on trial end date',
      is_inferred: true,
      confidence: 0.72,
    },
    price_amount: {
      value: 15,
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: '$15.00 / month after trial',
      is_inferred: false,
      confidence: 0.98,
    },
    currency: {
      value: 'USD',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: '$15.00',
      is_inferred: false,
      confidence: 0.99,
    },
    billing_period: {
      value: 'monthly',
      evidence_type: 'direct',
      review_status: 'ready',
      source_text: '/ month',
      is_inferred: false,
      confidence: 0.97,
    },
    cancellation_path: {
      value: null,
      evidence_type: 'missing',
      review_status: 'missing',
      source_text: 'No cancellation info on trial page',
      is_inferred: false,
    },
  },
}

// =========================================================================
// Validation Tests
// =========================================================================

describe('AI Extraction Schema — Validation', () => {
  it('accepts a complete valid extraction (SaaS billing)', () => {
    const result = validateAiExtraction(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
  })

  it('accepts all-null nullable fields', () => {
    const allNull: AiSubscriptionExtraction = {
      schema_version: '1.0',
      fields: {
        service_name: {
          value: 'Test', evidence_type: 'direct', review_status: 'ready',
          source_text: 'test', is_inferred: false,
        },
        plan_name: {
          value: null, evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
        category: {
          value: null, evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
        platform: {
          value: null, evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
        membership_start_date: {
          value: null, evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
        membership_end_date: {
          value: null, evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
        renewal_status: {
          value: 'unknown', evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
        next_charge_date: {
          value: null, evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
        price_amount: {
          value: null, evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
        currency: {
          value: null, evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
        billing_period: {
          value: null, evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
        cancellation_path: {
          value: null, evidence_type: 'missing', review_status: 'missing',
          source_text: null, is_inferred: false,
        },
      },
    }
    const result = validateAiExtraction(allNull)
    expect(result.ok).toBe(true)
  })

  it('accepts non-enum renewal_status at validation layer', () => {
    const invalid = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(invalid.fields.renewal_status as unknown as Record<string, unknown>).value = 'enabled'
    const result = validateAiExtraction(invalid)
    expect(result.ok).toBe(true)
  })

  it('accepts YYYY-MM-DD date format', () => {
    const result = validateAiExtraction(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.extraction.fields.membership_start_date.value).toBe('2026-01-15')
    }
  })

  it('accepts non-YYYY-MM-DD date at validation (normalization cleans it up)', () => {
    const invalid = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(invalid.fields.membership_start_date as unknown as Record<string, unknown>).value = 'Jan 15, 2026'
    const result = validateAiExtraction(invalid)
    expect(result.ok).toBe(true)
  })

  it('rejects non-numeric price_amount', () => {
    const invalid = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(invalid.fields.price_amount as unknown as Record<string, unknown>).value = '$10.00'
    const result = validateAiExtraction(invalid)
    expect(result.ok).toBe(false)
  })

  it('accepts negative price_amount at validation (normalization cleans it up)', () => {
    const invalid = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(invalid.fields.price_amount as unknown as Record<string, unknown>).value = -5
    const result = validateAiExtraction(invalid)
    expect(result.ok).toBe(true)
  })

  it('rejects unknown additional field at top level', () => {
    const extra = { ...SAAS_BILLING_EXTRACTION, model_name: 'gemini-pro' }
    const result = validateAiExtraction(extra)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.message.includes('Unexpected'))).toBe(true)
    }
  })

  it('rejects unknown additional field inside a field object', () => {
    const invalid = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(invalid.fields.service_name as unknown as Record<string, unknown>).ai_reasoning = 'because'
    const result = validateAiExtraction(invalid)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === 'service_name')).toBe(true)
    }
  })

  it('rejects a non-null non-object input', () => {
    expect(validateAiExtraction('hello').ok).toBe(false)
    expect(validateAiExtraction(42).ok).toBe(false)
    expect(validateAiExtraction(null).ok).toBe(false)
  })

  it('rejects wrong schema_version', () => {
    const invalid = { ...SAAS_BILLING_EXTRACTION, schema_version: '0.5' }
    const result = validateAiExtraction(invalid)
    expect(result.ok).toBe(false)
  })

  it('rejects user_edited evidence_type from AI', () => {
    const invalid = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(invalid.fields.service_name as unknown as Record<string, unknown>).evidence_type = 'user_edited'
    const result = validateAiExtraction(invalid)
    expect(result.ok).toBe(false)
  })

  it('rejects confirmed review_status from AI', () => {
    const invalid = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(invalid.fields.service_name as unknown as Record<string, unknown>).review_status = 'confirmed'
    const result = validateAiExtraction(invalid)
    expect(result.ok).toBe(false)
  })

  it('rejects confidence outside 0–1 range', () => {
    const invalid = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(invalid.fields.service_name as unknown as Record<string, unknown>).confidence = 1.5
    const result = validateAiExtraction(invalid)
    expect(result.ok).toBe(false)

    const invalid2 = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(invalid2.fields.service_name as unknown as Record<string, unknown>).confidence = -0.1
    const result2 = validateAiExtraction(invalid2)
    expect(result2.ok).toBe(false)
  })

  it('rejects missing required field is_inferred', () => {
    const invalid = structuredClone(SAAS_BILLING_EXTRACTION)
    delete (invalid.fields.service_name as unknown as Record<string, unknown>).is_inferred
    const result = validateAiExtraction(invalid)
    expect(result.ok).toBe(false)
  })
})

// =========================================================================
// Normalization Tests
// =========================================================================

describe('AI Extraction Schema — Normalization', () => {
  it('produces FieldEvidence array for valid extraction', () => {
    const result = processAiExtractionResponse(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.fields).toHaveLength(12)
      expect(result.fields[0]).toHaveProperty('field_name')
      expect(result.fields[0]).toHaveProperty('extracted_value')
      expect(result.fields[0]).toHaveProperty('evidence_type')
      expect(result.fields[0]).toHaveProperty('review_status')
      expect(result.fields[0]).toHaveProperty('user_confirmed', false)
      expect(result.fields[0]).toHaveProperty('confirmed_at', null)
      expect(result.fields[0]).toHaveProperty('model_confidence')
    }
  })

  it('maps AI field names to canonical field names', () => {
    const result = processAiExtractionResponse(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const fieldNames = result.fields.map((f) => f.field_name)
      expect(fieldNames).toContain('service_name')
      expect(fieldNames).toContain('renewal_price')
      expect(fieldNames).toContain('billing_cycle')
      expect(fieldNames).toContain('platform')
    }
  })

  it('normalizes empty strings to null', () => {
    const withEmpty = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(withEmpty.fields.platform as unknown as Record<string, unknown>).value = '   '
    const result = processAiExtractionResponse(withEmpty)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const platformField = result.fields.find((f) => f.field_name === 'platform')
      expect(platformField?.extracted_value).toBeNull()
    }
  })

  it('uppercases currency codes', () => {
    const lowerCurrency = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(lowerCurrency.fields.currency as unknown as Record<string, unknown>).value = 'usd'
    const result = processAiExtractionResponse(lowerCurrency)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const currencyField = result.fields.find((f) => f.field_name === 'currency')
      expect(currencyField?.extracted_value).toBe('USD')
    }
  })

  it('does not create a SubscriptionRecord', () => {
    const result = processAiExtractionResponse(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      for (const field of result.fields) {
        expect(field).toHaveProperty('field_name')
        expect(field).toHaveProperty('extracted_value')
        expect(field).not.toHaveProperty('facts')
      }
    }
  })

  it('does not emit confirmed review status from AI extraction', () => {
    const result = processAiExtractionResponse(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      for (const field of result.fields) {
        expect(field.review_status).not.toBe('confirmed')
      }
    }
  })

  it('does not emit user_edited evidence type from AI extraction', () => {
    const result = processAiExtractionResponse(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      for (const field of result.fields) {
        expect(field.evidence_type).not.toBe('user_edited')
      }
    }
  })

  it('model error: invalid date preserves evidence, uses needs_review, not missing', () => {
    const badDate = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(badDate.fields.membership_start_date as unknown as Record<string, unknown>).value = 'August 9'
    const result = processAiExtractionResponse(badDate)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const dateField = result.fields.find((f) => f.field_name === 'membership_start_date')
      expect(dateField?.extracted_value).toBeNull()
      // NOT missing — the model DID produce a value, it was just invalid
      expect(dateField?.evidence_type).toBe('direct') // preserved from original
      expect(dateField?.review_status).toBe('needs_review')
    }
  })

  it('strips invalid renewal_status enum to null', () => {
    const badRenewal = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(badRenewal.fields.renewal_status as unknown as Record<string, unknown>).value = 'maybe'
    const result = processAiExtractionResponse(badRenewal)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const renewalField = result.fields.find((f) => f.field_name === 'renewal_status')
      expect(renewalField?.extracted_value).toBeNull()
    }
  })

  it('strips negative price_amount to null', () => {
    const badPrice = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(badPrice.fields.price_amount as unknown as Record<string, unknown>).value = -5
    const result = processAiExtractionResponse(badPrice)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const priceField = result.fields.find((f) => f.field_name === 'renewal_price')
      expect(priceField?.extracted_value).toBeNull()
    }
  })

  it('handles invalid JSON as validation error', () => {
    const result = processAiExtractionResponse('not json')
    expect(result.ok).toBe(false)
  })

  it('handles null input as validation error', () => {
    const result = processAiExtractionResponse(null)
    expect(result.ok).toBe(false)
  })
})

// =========================================================================
// Example Payload Tests
// =========================================================================

describe('AI Extraction Schema — Example payloads', () => {
  it('SaaS Billing example validates and normalizes', () => {
    const result = processAiExtractionResponse(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const names = result.fields.map((f) => f.field_name)
      expect(names).toContain('service_name')
      expect(names).toContain('renewal_price')
      expect(names).toContain('billing_cycle')
    }
  })

  it('App Store example validates and normalizes', () => {
    const result = processAiExtractionResponse(APP_STORE_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const platformField = result.fields.find((f) => f.field_name === 'platform')
      expect(platformField?.extracted_value).toBe('App Store')
    }
  })

  it('Free Trial example validates and normalizes', () => {
    const result = processAiExtractionResponse(FREE_TRIAL_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const endDateField = result.fields.find((f) => f.field_name === 'membership_end_date')
      expect(endDateField?.extracted_value).toBe('2026-08-15')
    }
  })
})

// =========================================================================
// JSON Schema contract tests
// =========================================================================

describe('AI Extraction Schema — JSON Schema contract', () => {
  it('declares 12 field entries in the JSON Schema', () => {
    const fieldEntries = Object.keys(AI_EXTRACTION_JSON_SCHEMA.properties.fields.properties)
    expect(fieldEntries).toHaveLength(12)
    expect(fieldEntries.sort()).toEqual([...AI_EXTRACTION_FIELD_NAMES].sort())
  })

  it('forbids additional properties at root and fields level', () => {
    expect(AI_EXTRACTION_JSON_SCHEMA.additionalProperties).toBe(false)
    expect(AI_EXTRACTION_JSON_SCHEMA.properties.fields.additionalProperties).toBe(false)
  })

  it('does not allow user_edited in evidence_type enum', () => {
    const fields = AI_EXTRACTION_JSON_SCHEMA.properties.fields.properties as unknown as Record<string, unknown>
    const svc = (fields.service_name as unknown as Record<string, unknown>)
    const props = svc.properties as unknown as Record<string, unknown>
    const evidenceType = props.evidence_type as unknown as Record<string, unknown>
    expect(evidenceType.enum).not.toContain('user_edited')
  })

  it('does not allow confirmed in review_status enum', () => {
    const fields = AI_EXTRACTION_JSON_SCHEMA.properties.fields.properties as unknown as Record<string, unknown>
    const svc = (fields.service_name as unknown as Record<string, unknown>)
    const props = svc.properties as unknown as Record<string, unknown>
    const reviewStatus = props.review_status as unknown as Record<string, unknown>
    expect(reviewStatus.enum).not.toContain('confirmed')
  })

  it('has independent schema_version of "1.0"', () => {
    expect(AI_EXTRACTION_SCHEMA_VERSION).toBe('1.0')
    expect(AI_EXTRACTION_JSON_SCHEMA.properties.schema_version.const).toBe('1.0')
  })
})

// =========================================================================
// Fixture compatibility test
// =========================================================================

describe('AI Extraction Schema — Fixture compatibility', () => {
  it('AI extraction fields are a subset of canonical SubscriptionFactFieldName', () => {
    const result = processAiExtractionResponse(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      for (const field of result.fields) {
        expect(field).toHaveProperty('field_name')
        expect(field).toHaveProperty('extracted_value')
        expect(field).toHaveProperty('evidence_type')
        expect(field).toHaveProperty('review_status')
        expect(field).toHaveProperty('source_text')
        expect(field).toHaveProperty('is_inferred')
        expect(field).toHaveProperty('user_confirmed')
        expect(field).toHaveProperty('confirmed_at')
        expect(field).toHaveProperty('model_confidence')
      }
    }
  })

  it('fixture can be adapted into the same FieldEvidence shape', () => {
    const result = processAiExtractionResponse(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const serviceField = result.fields.find((f) => f.field_name === 'service_name')
      expect(serviceField).toBeDefined()
      expect(serviceField?.field_name).toBe('service_name')
      expect(typeof serviceField?.extracted_value).toBe('string')
    }
  })
})

// =========================================================================
// AI-01.1 Safety Layer — Model Error ≠ Source Missing
// =========================================================================

describe('AI Extraction Safety — Model Error vs Source Missing', () => {
  it('invalid date: value null, needs_review, invalid_date issue, raw_value preserved', () => {
    const bad = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(bad.fields.membership_end_date as unknown as Record<string, unknown>).value = '15/08/2026'
    // Also make evidence_type something other than 'missing' so this is clearly a model error
    ;(bad.fields.membership_end_date as unknown as Record<string, unknown>).evidence_type = 'direct'
    const result = processAiExtractionResponseDetailed(bad)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const dateField = result.result.fields.find((f) => f.field_name === 'membership_end_date')
      expect(dateField?.extracted_value).toBeNull()
      expect(dateField?.review_status).toBe('needs_review')
      // Evidence preserved from model (not changed to missing)
      expect(dateField?.evidence_type).toBe('direct')
      const issues = result.result.issues.filter((i) => i.code === 'invalid_date')
      expect(issues).toHaveLength(1)
      expect(issues[0].raw_value).toBe('15/08/2026')
    }
  })

  it('invalid renewal enum: value null, needs_review, invalid_enum, raw_value yes', () => {
    const bad = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(bad.fields.renewal_status as unknown as Record<string, unknown>).value = 'yes'
    const result = processAiExtractionResponseDetailed(bad)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const renewalField = result.result.fields.find((f) => f.field_name === 'renewal_status')
      expect(renewalField?.extracted_value).toBeNull()
      expect(renewalField?.review_status).toBe('needs_review')
      const issues = result.result.issues.filter((i) => i.code === 'invalid_enum')
      expect(issues).toHaveLength(1)
      expect(issues[0].raw_value).toBe('yes')
    }
  })

  it('negative price: value null, needs_review, invalid_number, raw_value -10', () => {
    const bad = structuredClone(SAAS_BILLING_EXTRACTION)
    ;(bad.fields.price_amount as unknown as Record<string, unknown>).value = -10
    const result = processAiExtractionResponseDetailed(bad)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const priceField = result.result.fields.find((f) => f.field_name === 'renewal_price')
      expect(priceField?.extracted_value).toBeNull()
      expect(priceField?.review_status).toBe('needs_review')
      const issues = result.result.issues.filter((i) => i.code === 'invalid_number')
      expect(issues).toHaveLength(1)
      expect(issues[0].raw_value).toBe(-10)
    }
  })

  it('genuine source missing: value null, evidence missing, review missing, NO model-error issue', () => {
    // The SaaS example already has membership_end_date with evidence_type=missing, value=null
    const result = processAiExtractionResponseDetailed(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const endDateField = result.result.fields.find((f) => f.field_name === 'membership_end_date')
      expect(endDateField?.extracted_value).toBeNull()
      expect(endDateField?.evidence_type).toBe('missing')
      expect(endDateField?.review_status).toBe('missing')
      // No invalid_date issue for genuine missing
      const dateIssues = result.result.issues.filter(
        (i) => i.code === 'invalid_date' && i.field === 'membership_end_date'
      )
      expect(dateIssues).toHaveLength(0)
    }
  })
})

// =========================================================================
// AI-01.1 Safety Layer — Field State Consistency
// =========================================================================

describe('AI Extraction Safety — Field State Consistency', () => {
  it('null + direct + ready → invalid_field_state issue + needs_review', () => {
    const bad = structuredClone(SAAS_BILLING_EXTRACTION)
    bad.fields.service_name.value = null
    bad.fields.service_name.evidence_type = 'direct'
    bad.fields.service_name.review_status = 'ready'
    const result = processAiExtractionResponseDetailed(bad)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter((i) => i.code === 'invalid_field_state')
      expect(issues.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('non-null value + missing evidence → invalid_field_state', () => {
    const bad = structuredClone(SAAS_BILLING_EXTRACTION)
    bad.fields.platform.value = 'App Store'
    bad.fields.platform.evidence_type = 'missing'
    const result = processAiExtractionResponseDetailed(bad)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter(
        (i) => i.code === 'invalid_field_state' && i.field === 'platform',
      )
      expect(issues.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('non-null value + missing review → invalid_field_state', () => {
    const bad = structuredClone(SAAS_BILLING_EXTRACTION)
    bad.fields.category.value = 'Design'
    bad.fields.category.review_status = 'missing'
    const result = processAiExtractionResponseDetailed(bad)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter(
        (i) => i.code === 'invalid_field_state' && i.field === 'category',
      )
      expect(issues.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('conflict evidence + ready review → corrected to conflict', () => {
    const bad = structuredClone(SAAS_BILLING_EXTRACTION)
    bad.fields.price_amount.evidence_type = 'conflict'
    bad.fields.price_amount.review_status = 'ready'
    const result = processAiExtractionResponseDetailed(bad)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const priceField = result.result.fields.find((f) => f.field_name === 'renewal_price')
      expect(priceField?.review_status).toBe('conflict')
    }
  })

  it('inferred + ready → corrected to needs_review', () => {
    const bad = structuredClone(SAAS_BILLING_EXTRACTION)
    bad.fields.category.evidence_type = 'inferred'
    bad.fields.category.review_status = 'ready'
    const result = processAiExtractionResponseDetailed(bad)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const catField = result.result.fields.find((f) => f.field_name === 'category')
      expect(catField?.review_status).toBe('needs_review')
    }
  })
})

// =========================================================================
// AI-01.1 Safety Layer — Cross-field Semantic Consistency
// =========================================================================

describe('AI Extraction Safety — Cross-field Consistency', () => {
  it('auto_renew_on + next_charge_date ready → legal (no issue)', () => {
    const result = processAiExtractionResponseDetailed(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter((i) => i.code === 'renewal_charge_conflict')
      expect(issues).toHaveLength(0)
    }
  })

  it('auto_renew_on + next_charge_date missing → legal', () => {
    const ext = structuredClone(SAAS_BILLING_EXTRACTION)
    ext.fields.renewal_status.value = 'auto_renew_on'
    ext.fields.next_charge_date.value = null
    ext.fields.next_charge_date.evidence_type = 'missing'
    ext.fields.next_charge_date.review_status = 'missing'
    const result = processAiExtractionResponseDetailed(ext)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter((i) => i.code === 'renewal_charge_conflict')
      expect(issues).toHaveLength(0)
    }
  })

  it('auto_renew_off + ready next_charge_date → renewal_charge_conflict', () => {
    const ext = structuredClone(SAAS_BILLING_EXTRACTION)
    ext.fields.renewal_status.value = 'auto_renew_off'
    ext.fields.next_charge_date.value = '2026-09-01'
    ext.fields.next_charge_date.review_status = 'ready'
    const result = processAiExtractionResponseDetailed(ext)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter((i) => i.code === 'renewal_charge_conflict')
      expect(issues.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('manual_renewal + ready next_charge_date → renewal_charge_conflict', () => {
    const ext = structuredClone(SAAS_BILLING_EXTRACTION)
    ext.fields.renewal_status.value = 'manual_renewal'
    ext.fields.next_charge_date.value = '2026-09-01'
    ext.fields.next_charge_date.review_status = 'ready'
    const result = processAiExtractionResponseDetailed(ext)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter((i) => i.code === 'renewal_charge_conflict')
      expect(issues.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('not_applicable + ready next_charge_date → renewal_charge_conflict', () => {
    const ext = structuredClone(SAAS_BILLING_EXTRACTION)
    ext.fields.renewal_status.value = 'not_applicable'
    ext.fields.next_charge_date.value = '2026-09-01'
    ext.fields.next_charge_date.review_status = 'ready'
    const result = processAiExtractionResponseDetailed(ext)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter((i) => i.code === 'renewal_charge_conflict')
      expect(issues.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('unknown renewal + next_charge_date → needs_review, not deleted', () => {
    const ext = structuredClone(SAAS_BILLING_EXTRACTION)
    ext.fields.renewal_status.value = 'unknown'
    ext.fields.next_charge_date.value = '2026-09-01'
    ext.fields.next_charge_date.review_status = 'ready'
    const result = processAiExtractionResponseDetailed(ext)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const ncField = result.result.fields.find((f) => f.field_name === 'next_charge_date')
      // Value preserved — not deleted
      expect(ncField?.extracted_value).toBe('2026-09-01')
      // Should be needs_review
      expect(ncField?.review_status).toBe('needs_review')
    }
  })

  it('start_date <= end_date → legal (no date_range_conflict)', () => {
    const ext = structuredClone(SAAS_BILLING_EXTRACTION)
    ext.fields.membership_start_date.value = '2026-01-01'
    ext.fields.membership_end_date.value = '2026-12-31'
    const result = processAiExtractionResponseDetailed(ext)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter((i) => i.code === 'date_range_conflict')
      expect(issues).toHaveLength(0)
    }
  })

  it('start_date > end_date → date_range_conflict on both fields', () => {
    const ext = structuredClone(SAAS_BILLING_EXTRACTION)
    ext.fields.membership_start_date.value = '2026-12-31'
    ext.fields.membership_end_date.value = '2026-01-01'
    const result = processAiExtractionResponseDetailed(ext)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter((i) => i.code === 'date_range_conflict')
      expect(issues.length).toBeGreaterThanOrEqual(2)
      const startField = result.result.fields.find((f) => f.field_name === 'membership_start_date')
      const endField = result.result.fields.find((f) => f.field_name === 'membership_end_date')
      expect(startField?.review_status).toBe('conflict')
      expect(endField?.review_status).toBe('conflict')
    }
  })

  it('price + currency present → legal (no missing_currency)', () => {
    const result = processAiExtractionResponseDetailed(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter((i) => i.code === 'missing_currency')
      expect(issues).toHaveLength(0)
    }
  })

  it('price present + currency missing → missing_currency + price needs_review', () => {
    const ext = structuredClone(SAAS_BILLING_EXTRACTION)
    ext.fields.price_amount.value = 20
    ext.fields.currency.value = null
    ext.fields.currency.evidence_type = 'missing'
    ext.fields.currency.review_status = 'missing'
    const result = processAiExtractionResponseDetailed(ext)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const issues = result.result.issues.filter((i) => i.code === 'missing_currency')
      expect(issues.length).toBeGreaterThanOrEqual(1)
      // Price should not be deleted
      const priceField = result.result.fields.find((f) => f.field_name === 'renewal_price')
      expect(priceField?.extracted_value).toBe(20)
      expect(priceField?.review_status).toBe('needs_review')
    }
  })
})

// =========================================================================
// AI-01.1 Safety Layer — Regression (AI-01 invariants)
// =========================================================================

describe('AI Extraction Safety — Regression', () => {
  it('SaaS Billing example still passes', () => {
    const result = processAiExtractionResponse(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
  })

  it('App Store example still passes', () => {
    const result = processAiExtractionResponse(APP_STORE_EXTRACTION)
    expect(result.ok).toBe(true)
  })

  it('Free Trial example still passes', () => {
    const result = processAiExtractionResponse(FREE_TRIAL_EXTRACTION)
    expect(result.ok).toBe(true)
  })

  it('no confirmed review status from AI', () => {
    const result = processAiExtractionResponseDetailed(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      for (const field of result.result.fields) {
        expect(field.review_status).not.toBe('confirmed')
      }
    }
  })

  it('no user_edited evidence type from AI', () => {
    const result = processAiExtractionResponseDetailed(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      for (const field of result.result.fields) {
        expect(field.evidence_type).not.toBe('user_edited')
      }
    }
  })

  it('confidence not in canonical SubscriptionFacts', () => {
    const result = processAiExtractionResponseDetailed(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      for (const field of result.result.fields) {
        expect(field).not.toHaveProperty('facts')
      }
    }
  })

  it('normalization does not create SubscriptionRecord', () => {
    const result = processAiExtractionResponseDetailed(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.result).not.toHaveProperty('record')
      expect(result.result).not.toHaveProperty('subscription')
    }
  })

  it('domain model not modified (FieldEvidence shape intact)', () => {
    const result = processAiExtractionResponseDetailed(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      for (const field of result.result.fields) {
        expect(field).toHaveProperty('field_name')
        expect(field).toHaveProperty('extracted_value')
        expect(field).toHaveProperty('evidence_type')
        expect(field).toHaveProperty('review_status')
        expect(field).toHaveProperty('user_confirmed')
        expect(field).toHaveProperty('confirmed_at')
      }
    }
  })

  it('backward-compatible processAiExtractionResponse still returns fields', () => {
    const result = processAiExtractionResponse(SAAS_BILLING_EXTRACTION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.fields).toHaveLength(12)
    }
  })
})
