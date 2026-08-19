import { describe, expect, it } from 'vitest'
import {
  AI_EXTRACTION_JSON_SCHEMA,
  AI_EXTRACTION_SCHEMA_VERSION,
  AI_EXTRACTION_FIELD_NAMES,
} from '../ai'
import { toGeminiResponseJsonSchema } from '../../server/geminiSchemaAdapter'

function getSchemaVersionSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties as Record<string, unknown>
  return properties.schema_version as Record<string, unknown>
}

describe('Gemini schema adapter', () => {
  it('keeps the canonical schema_version contract as const "1.0"', () => {
    const schemaVersion = getSchemaVersionSchema(
      AI_EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
    )

    expect(AI_EXTRACTION_SCHEMA_VERSION).toBe('1.0')
    expect(schemaVersion).toEqual({ type: 'string', const: '1.0' })
  })

  it('derives Gemini schema_version from canonical const as enum ["1.0"]', () => {
    const geminiSchema = toGeminiResponseJsonSchema(
      AI_EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
    )
    const schemaVersion = getSchemaVersionSchema(geminiSchema)

    expect(schemaVersion).toEqual({ type: 'string', enum: ['1.0'] })
  })

  it('does not mutate the canonical schema', () => {
    const before = JSON.stringify(AI_EXTRACTION_JSON_SCHEMA)

    toGeminiResponseJsonSchema(
      AI_EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
    )

    expect(JSON.stringify(AI_EXTRACTION_JSON_SCHEMA)).toBe(before)
  })

  it('removes const from Gemini output while preserving existing constraints', () => {
    const geminiSchema = toGeminiResponseJsonSchema(
      AI_EXTRACTION_JSON_SCHEMA as unknown as Record<string, unknown>,
    )
    const json = JSON.stringify(geminiSchema)
    const fields = ((geminiSchema.properties as Record<string, unknown>).fields as Record<string, unknown>)
    const fieldProperties = fields.properties as Record<string, unknown>
    const serviceName = fieldProperties.service_name as Record<string, unknown>
    const confidence = (serviceName.properties as Record<string, unknown>).confidence as Record<string, unknown>

    expect(json).not.toContain('"const"')
    expect(fields.required).toEqual(AI_EXTRACTION_FIELD_NAMES)
    expect(fields.additionalProperties).toBe(false)
    expect(json).toContain('"enum"')
    expect(confidence.minimum).toBe(0)
    expect(confidence.maximum).toBe(1)
  })
})
