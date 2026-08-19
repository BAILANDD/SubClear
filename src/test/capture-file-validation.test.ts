import { describe, expect, it } from 'vitest'
import {
  MAX_CAPTURE_FILE_SIZE_BYTES,
  validateCaptureFile,
} from '../capture/fileValidation'

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('capture file validation', () => {
  it('accepts PNG, JPEG, and WebP single image files', () => {
    expect(validateCaptureFile(file('membership.png', 'image/png', 10))).toEqual({ status: 'valid' })
    expect(validateCaptureFile(file('membership.jpg', 'image/jpeg', 10))).toEqual({ status: 'valid' })
    expect(validateCaptureFile(file('membership.webp', 'image/webp', 10))).toEqual({ status: 'valid' })
  })

  it('rejects invalid type, oversized, and empty files with structured reasons', () => {
    expect(validateCaptureFile(file('membership.pdf', 'application/pdf', 10))).toEqual({
      status: 'unsupported_type',
    })
    expect(validateCaptureFile(file('membership.png', 'image/png', MAX_CAPTURE_FILE_SIZE_BYTES + 1)))
      .toEqual({ status: 'file_too_large' })
    expect(validateCaptureFile(file('membership.png', 'image/png', 0))).toEqual({
      status: 'empty_file',
    })
  })
})
