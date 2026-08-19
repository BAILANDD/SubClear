import { deriveMembershipStatus, getRemainingDays } from '../domain/derived'
import {
  CURRENT_SCHEMA_VERSION,
  type EvidenceRecord,
  type MembershipStatus,
  type SubscriptionFacts,
  type SubscriptionRecord,
  type TechnicalStorageMetadata,
} from '../types'

export const EXPORT_VERSION = 1 as const

export const CSV_EXPORT_HEADERS = [
  'id',
  'service_name',
  'plan_name',
  'category',
  'platform',
  'entitlement_type',
  'membership_start_date',
  'membership_end_date',
  'renewal_status',
  'next_charge_date',
  'renewal_price',
  'currency',
  'billing_cycle',
  'cancellation_status',
  'cancellation_path',
  'cancellation_steps',
  'cancellation_deadline',
  'planned_cancel_date',
  'cancellation_completed_at',
  'cancellation_proof',
  'reminder_enabled',
  'reminder_offset_days',
  'reminder_state',
  'schema_version',
  'created_at',
  'updated_at',
] as const

type CSVExportHeader = (typeof CSV_EXPORT_HEADERS)[number]

type ExportFactDTO = Omit<SubscriptionFacts, 'evidence_records'>

export interface DerivedExportSnapshot {
  generated_at: string
  reference_date: string
  derived_at_export_time: true
  membership_status: MembershipStatus
  remaining_days: number | null
}

export interface ExportedRecord {
  facts: ExportFactDTO
  evidence: EvidenceRecord[]
  storage_metadata: TechnicalStorageMetadata | null
  derived_snapshot: DerivedExportSnapshot
}

export interface SubClearJSONExport {
  export_format: 'subclear'
  export_version: typeof EXPORT_VERSION
  generated_at: string
  schema_version: typeof CURRENT_SCHEMA_VERSION
  records: ExportedRecord[]
}

export interface ExportBuildOptions {
  generatedAt: string
  referenceDate: string
}

export type ExportDownloadResult =
  | {
      ok: true
    }
  | {
      ok: false
      error: 'transform_failed' | 'safety_failed' | 'download_failed'
    }

type ExportDownloadError = Extract<ExportDownloadResult, { ok: false }>['error']

export function buildCSVExport(records: readonly SubscriptionRecord[]): string {
  const rows = records.map((record) => buildCSVRow(record))
  const headerLine = CSV_EXPORT_HEADERS.join(',')
  const bodyLines = rows.map((row) => CSV_EXPORT_HEADERS.map((header) => escapeCSVCell(row[header])).join(','))

  return `\uFEFF${headerLine}${bodyLines.length > 0 ? `\n${bodyLines.join('\n')}` : ''}`
}

export function buildJSONExport(
  records: readonly SubscriptionRecord[],
  options: ExportBuildOptions,
): SubClearJSONExport {
  const payload: SubClearJSONExport = {
    export_format: 'subclear',
    export_version: EXPORT_VERSION,
    generated_at: options.generatedAt,
    schema_version: CURRENT_SCHEMA_VERSION,
    records: records.map((record) => buildExportedRecord(record, options)),
  }

  assertExportSafe(payload)
  return payload
}

export function exportCSV(records: readonly SubscriptionRecord[]): ExportDownloadResult {
  try {
    const csv = buildCSVExport(records)
    assertExportSafe(csv)
    return downloadBlob(csv, 'subclear-subscriptions.csv', 'text/csv;charset=utf-8')
  } catch (error) {
    return {
      ok: false,
      error: getExportError(error),
    }
  }
}

export function exportJSON(records: readonly SubscriptionRecord[]): ExportDownloadResult {
  try {
    const generatedAt = new Date().toISOString()
    const referenceDate = generatedAt.split('T')[0]
    const payload = buildJSONExport(records, {
      generatedAt,
      referenceDate,
    })
    const json = JSON.stringify(payload, null, 2)
    return downloadBlob(json, 'subclear-subscriptions.json', 'application/json')
  } catch (error) {
    return {
      ok: false,
      error: getExportError(error),
    }
  }
}

export function assertExportSafe(value: unknown): void {
  assertValueSafe(value, '$')
}

function buildExportedRecord(record: SubscriptionRecord, options: ExportBuildOptions): ExportedRecord {
  return {
    facts: pickFacts(record.facts),
    evidence: record.facts.evidence_records.map((evidence) => ({
      ...evidence,
      extracted_fields: evidence.extracted_fields.map((field) => ({ ...field })),
    })),
    storage_metadata: record.metadata ? { ...record.metadata } : null,
    derived_snapshot: {
      generated_at: options.generatedAt,
      reference_date: options.referenceDate,
      derived_at_export_time: true,
      membership_status: deriveMembershipStatus(record.facts, {
        referenceDate: options.referenceDate,
      }),
      remaining_days: getRemainingDays(record.facts, options.referenceDate),
    },
  }
}

function pickFacts(facts: SubscriptionFacts): ExportFactDTO {
  return {
    id: facts.id,
    service_name: facts.service_name,
    plan_name: facts.plan_name,
    category: facts.category,
    platform: facts.platform,
    entitlement_type: facts.entitlement_type,
    membership_start_date: facts.membership_start_date,
    membership_end_date: facts.membership_end_date,
    renewal_status: facts.renewal_status,
    next_charge_date: facts.next_charge_date,
    renewal_price: facts.renewal_price,
    currency: facts.currency,
    billing_cycle: facts.billing_cycle,
    cancellation_status: facts.cancellation_status,
    cancellation_path: facts.cancellation_path,
    cancellation_steps: [...facts.cancellation_steps],
    cancellation_deadline: facts.cancellation_deadline,
    planned_cancel_date: facts.planned_cancel_date,
    cancellation_completed_at: facts.cancellation_completed_at,
    cancellation_proof: facts.cancellation_proof,
    reminder_settings: { ...facts.reminder_settings },
    schema_version: facts.schema_version,
    created_at: facts.created_at,
    updated_at: facts.updated_at,
  }
}

function buildCSVRow(record: SubscriptionRecord): Record<CSVExportHeader, string> {
  const facts = record.facts

  return {
    id: facts.id,
    service_name: facts.service_name,
    plan_name: facts.plan_name ?? '',
    category: facts.category ?? '',
    platform: facts.platform ?? '',
    entitlement_type: facts.entitlement_type,
    membership_start_date: facts.membership_start_date ?? '',
    membership_end_date: facts.membership_end_date ?? '',
    renewal_status: facts.renewal_status,
    next_charge_date: facts.next_charge_date ?? '',
    renewal_price: facts.renewal_price === null ? '' : String(facts.renewal_price),
    currency: facts.currency ?? '',
    billing_cycle: facts.billing_cycle ?? '',
    cancellation_status: facts.cancellation_status,
    cancellation_path: facts.cancellation_path ?? '',
    cancellation_steps: JSON.stringify(facts.cancellation_steps),
    cancellation_deadline: facts.cancellation_deadline ?? '',
    planned_cancel_date: facts.planned_cancel_date ?? '',
    cancellation_completed_at: facts.cancellation_completed_at ?? '',
    cancellation_proof: facts.cancellation_proof ?? '',
    reminder_enabled: String(facts.reminder_settings.enabled),
    reminder_offset_days: String(facts.reminder_settings.offset_days),
    reminder_state: facts.reminder_settings.state ?? '',
    schema_version: String(facts.schema_version),
    created_at: facts.created_at,
    updated_at: facts.updated_at,
  }
}

function escapeCSVCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function downloadBlob(content: string, filename: string, mimeType: string): ExportDownloadResult {
  let objectUrl: string | null = null
  let anchor: HTMLAnchorElement | null = null

  try {
    const blob = new Blob([content], { type: mimeType })
    objectUrl = URL.createObjectURL(blob)
    anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    return { ok: true }
  } catch {
    return {
      ok: false,
      error: 'download_failed',
    }
  } finally {
    if (anchor?.parentNode) {
      anchor.parentNode.removeChild(anchor)
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
    }
  }
}

function getExportError(error: unknown): ExportDownloadError {
  if (error instanceof ExportSafetyError) {
    return 'safety_failed'
  }

  return 'transform_failed'
}

class ExportSafetyError extends Error {
  constructor(path: string) {
    super(`Unsafe export payload at ${path}`)
    this.name = 'ExportSafetyError'
  }
}

function assertValueSafe(value: unknown, path: string): void {
  if (isUnsafeBinaryLike(value)) {
    throw new ExportSafetyError(path)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:image/')) {
      throw new ExportSafetyError(path)
    }
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertValueSafe(item, `${path}[${index}]`))
    return
  }

  if (typeof value === 'object' && value !== null) {
    Object.entries(value).forEach(([key, item]) => assertValueSafe(item, `${path}.${key}`))
  }
}

function isUnsafeBinaryLike(value: unknown): boolean {
  if (typeof File !== 'undefined' && value instanceof File) {
    return true
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return true
  }

  if (value instanceof ArrayBuffer) {
    return true
  }

  return ArrayBuffer.isView(value)
}
