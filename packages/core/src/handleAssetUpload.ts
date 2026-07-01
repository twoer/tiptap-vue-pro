import type { EditorAssetBehaviorOptions } from './editorBehaviorOptions'
import type {
  NotifyFn,
  ProEditorContext,
  UploadedAsset,
  UploadAssetKind,
} from './types'
import { formatFileSize } from './handleImageUpload'

export type AssetFileValidationFailure =
  | {
    reason: 'invalid-type'
    kind: UploadAssetKind
    file: File
    accept: string
  }
  | {
    reason: 'too-large'
    kind: UploadAssetKind
    file: File
    size: number
    maxSize: number
  }

export function normalizeUploadedAsset(
  value: string | UploadedAsset,
  file: File,
): UploadedAsset {
  if (typeof value === 'string') {
    return {
      url: value,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      uploadedAt: file.lastModified,
    }
  }
  return {
    url: value.url,
    name: value.name ?? file.name,
    size: value.size ?? file.size,
    mimeType: value.mimeType ?? file.type,
    ...(value.fileTypeText != null ? { fileTypeText: value.fileTypeText } : {}),
    uploadedAt: value.uploadedAt ?? file.lastModified,
    duration: value.duration,
    poster: value.poster,
  }
}

function acceptMatches(file: File, accept: string | undefined): boolean {
  if (!accept || accept === '*') return true
  const parts = accept.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) return true
  return parts.some((part) => {
    if (part.endsWith('/*')) return file.type.startsWith(part.slice(0, -1))
    if (part.startsWith('.')) {
      return file.name.toLowerCase().endsWith(part.toLowerCase())
    }
    return file.type === part
  })
}

export function validateAssetFile(
  file: File,
  kind: UploadAssetKind,
  options: EditorAssetBehaviorOptions = {},
): AssetFileValidationFailure | null {
  const accept = options.accept ?? '*'
  if (!acceptMatches(file, accept)) {
    return { reason: 'invalid-type', kind, file, accept }
  }
  const maxSize = options.maxSize
  if (typeof maxSize === 'number' && maxSize > 0 && file.size > maxSize) {
    return { reason: 'too-large', kind, file, size: file.size, maxSize }
  }
  return null
}

export function notifyAssetFileValidationFailure(
  ctx: Pick<ProEditorContext, 'notify' | 't'>,
  failure: AssetFileValidationFailure,
) {
  if (failure.reason === 'too-large') {
    ctx.notify(
      ctx.t('notify.assetFileTooLarge', {
        size: formatFileSize(failure.size),
        limit: formatFileSize(failure.maxSize),
      }),
      'warning',
    )
    return
  }

  const keyByKind = {
    image: 'notify.invalidImageFile',
    video: 'notify.invalidVideoFile',
    audio: 'notify.invalidAudioFile',
    file: 'notify.invalidAttachmentFile',
  } as const
  ctx.notify(ctx.t(keyByKind[failure.kind]), 'warning')
}

export function notifyAssetUploadFailure(
  notify: NotifyFn,
  t: ProEditorContext['t'],
  kind: UploadAssetKind,
) {
  const keyByKind = {
    image: 'notify.imageUploadFailed',
    video: 'notify.videoUploadFailed',
    audio: 'notify.audioUploadFailed',
    file: 'notify.fileUploadFailed',
  } as const
  notify(t(keyByKind[kind]), 'error')
}
