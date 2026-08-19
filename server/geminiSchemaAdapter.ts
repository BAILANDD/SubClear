/**
 * Adapter: converts the canonical AI_EXTRACTION_JSON_SCHEMA into a
 * Gemini Structured Output compatible JSON Schema.
 *
 * Gemini does NOT support the `const` keyword — it must be converted to
 * a single-element `enum`.  No other transformations are needed for the
 * current AI-01 schema.
 *
 * The canonical schema is NEVER modified — this is a pure derived output.
 */
export function toGeminiResponseJsonSchema(
  canonical: Record<string, unknown>,
): Record<string, unknown> {
  return transformConstToEnum(structuredClone(canonical)) as Record<string, unknown>
}

/**
 * Deep-walk: replace every `{ const: <value> }` with `{ enum: [<value>] }`.
 */
function transformConstToEnum(node: unknown): unknown {
  if (node === null || typeof node !== 'object') return node

  if (Array.isArray(node)) {
    return node.map(transformConstToEnum)
  }

  const obj = node as Record<string, unknown>

  // Detect `{ const: <value> }` pattern — Gemini treats `const` as a
  // property constraint, but does not support the JSON Schema `const` keyword.
  if ('const' in obj && typeof obj.const !== 'object') {
    const { const: constVal, ...rest } = obj
    return transformConstToEnum({ ...rest, enum: [constVal] })
  }

  // Recurse into all properties
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    result[key] = transformConstToEnum(obj[key])
  }
  return result
}
