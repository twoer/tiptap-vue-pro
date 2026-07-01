import { describe, expect, it, vi } from 'vitest'
import {
  normalizeUploadedAsset,
  notifyAssetFileValidationFailure,
  validateAssetFile,
} from './handleAssetUpload'

function file(name: string, type: string, size = 1) {
  return new File([new Uint8Array(size)], name, {
    type,
    lastModified: 123456,
  })
}

describe('asset upload helpers', () => {
  it('normalizes a URL string into an uploaded asset', () => {
    expect(normalizeUploadedAsset('https://example.com/demo.mp4', file('demo.mp4', 'video/mp4'))).toEqual({
      url: 'https://example.com/demo.mp4',
      name: 'demo.mp4',
      size: 1,
      mimeType: 'video/mp4',
      uploadedAt: 123456,
    })
  })

  it('keeps explicit uploaded asset metadata', () => {
    expect(normalizeUploadedAsset({
      url: 'https://example.com/a.pdf',
      name: 'A.pdf',
      size: 10,
      mimeType: 'application/pdf',
      fileTypeText: 'Contract',
      uploadedAt: '2026-06-30T10:20:30.000Z',
      duration: 120,
      poster: 'https://example.com/a-cover.jpg',
    }, file('fallback.pdf', 'application/pdf'))).toEqual({
      url: 'https://example.com/a.pdf',
      name: 'A.pdf',
      size: 10,
      mimeType: 'application/pdf',
      fileTypeText: 'Contract',
      uploadedAt: '2026-06-30T10:20:30.000Z',
      duration: 120,
      poster: 'https://example.com/a-cover.jpg',
    })
  })

  it('rejects invalid video file types', () => {
    const f = file('a.txt', 'text/plain')
    expect(validateAssetFile(f, 'video', { accept: 'video/*' })).toEqual({
      reason: 'invalid-type',
      file: f,
      kind: 'video',
      accept: 'video/*',
    })
  })

  it('accepts extension based rules', () => {
    expect(validateAssetFile(file('a.PDF', ''), 'file', { accept: '.pdf,.docx' })).toBeNull()
  })

  it('rejects files larger than maxSize', () => {
    const f = file('a.mp4', 'video/mp4', 2048)
    expect(validateAssetFile(f, 'video', { maxSize: 1024 })).toEqual({
      reason: 'too-large',
      file: f,
      kind: 'video',
      size: 2048,
      maxSize: 1024,
    })
  })

  it('notifies validation failures with localized messages', () => {
    const notify = vi.fn()
    const t = vi.fn((key: string) => key)
    notifyAssetFileValidationFailure({ notify, t: t as never }, {
      reason: 'invalid-type',
      kind: 'audio',
      file: file('a.txt', 'text/plain'),
      accept: 'audio/*',
    })
    expect(notify).toHaveBeenCalledWith('notify.invalidAudioFile', 'warning')
  })
})
