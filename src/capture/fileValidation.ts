export const SUPPORTED_CAPTURE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export const MAX_CAPTURE_FILE_SIZE_BYTES = 10 * 1024 * 1024

export type CaptureFileValidationResult =
  | { status: 'valid' }
  | { status: 'unsupported_type' }
  | { status: 'file_too_large' }
  | { status: 'empty_file' }

export function validateCaptureFile(file: File): CaptureFileValidationResult {
  if (file.size === 0) {
    return { status: 'empty_file' }
  }

  if (!SUPPORTED_CAPTURE_MIME_TYPES.includes(file.type as (typeof SUPPORTED_CAPTURE_MIME_TYPES)[number])) {
    return { status: 'unsupported_type' }
  }

  if (file.size > MAX_CAPTURE_FILE_SIZE_BYTES) {
    return { status: 'file_too_large' }
  }

  return { status: 'valid' }
}
