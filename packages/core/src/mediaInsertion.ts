import type { Editor as CoreEditor } from '@tiptap/core'
import { detectFileAttachmentIcon } from './extensions/media'
import {
  normalizeUploadedAsset,
  notifyAssetFileValidationFailure,
  notifyAssetUploadFailure,
  validateAssetFile,
} from './handleAssetUpload'
import type { ProEditorDebugLogFn } from './debug'
import type { LocaleTranslate } from './locale'
import type { ResolvedEditorBehaviorOptions } from './editorBehaviorOptions'
import type { NotifyFn, ProEditorOptions, UploadedAsset } from './types'

/**
 * 媒体插入器:文件附件/视频/音频资产的节点构造与上传编排。
 *
 * 从 useProEditor 中拆出的内聚模块——把 UploadedAsset 规范化为对应
 * 媒体节点的 attrs(含渲染开关、本地化文案、上传时间/时长格式化),
 * 以及「校验 → 上传 → 通知 → 插入」的上传编排链路。不读 DOM、不依赖 UI。
 */
export interface MediaInserterDeps {
  getEditor: () => CoreEditor | undefined
  getBehaviorOptions: () => ResolvedEditorBehaviorOptions
  t: LocaleTranslate
  notify: NotifyFn
  debugLog: ProEditorDebugLogFn
  uploadAsset: ProEditorOptions['uploadAsset']
}

export function createMediaInserter(deps: MediaInserterDeps) {
  const { getEditor, getBehaviorOptions, t, notify, debugLog, uploadAsset } = deps

  function normalizeAssetForNode(asset: UploadedAsset | string): UploadedAsset {
    if (typeof asset === 'string') return { url: asset }
    return {
      ...asset,
      uploadedAt: asset.uploadedAt instanceof Date
        ? asset.uploadedAt.toISOString()
        : asset.uploadedAt,
    }
  }

  function formatFileUploadedAt(
    value: UploadedAsset['uploadedAt'],
    format: ResolvedEditorBehaviorOptions['media']['file']['render']['uploadedAtFormat'],
  ) {
    if (value == null || value === '') return ''
    if (typeof format === 'function') return format(value)
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    const pad = (n: number) => String(n).padStart(2, '0')
    const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    if (format === 'date') return datePart
    return `${datePart} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  function formatFileDuration(
    value: UploadedAsset['duration'],
    format: ResolvedEditorBehaviorOptions['media']['file']['render']['durationFormat'],
  ) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return ''
    if (typeof format === 'function') return format(value)
    return ''
  }

  function localizedFileTypeText(attrs: Record<string, unknown>) {
    const fileTypeText = String(attrs.fileTypeText ?? '')
    if (fileTypeText) return fileTypeText
    const icon = detectFileAttachmentIcon({
      name: attrs.name,
      href: attrs.href,
      mimeType: attrs.mimeType ?? '',
      mediaKind: attrs.mediaKind,
    })
    const name = String(attrs.name ?? attrs.href ?? '').toLowerCase()
    if (icon === 'pdf') return 'PDF'
    if (icon === 'doc') return 'Word'
    if (icon === 'sheet') return name.endsWith('.csv') ? 'CSV' : 'Excel'
    if (icon === 'slide') return 'PPT'
    if (icon === 'archive') return t('file.type.archive')
    if (icon === 'image') return t('file.type.image')
    if (icon === 'video') return t('file.type.video')
    if (icon === 'audio') return t('file.type.audio')
    if (icon === 'text') return t('file.type.text')
    if (icon === 'code') return t('file.type.code')
    const subtype = String(attrs.mimeType ?? '').split('/')[1]?.split(';')[0]
    return subtype ? subtype.toUpperCase() : t('file.type.file')
  }

  function insertFileAsset(
    asset: UploadedAsset | string,
    mediaKind: 'video' | 'audio' | 'file' = 'file',
  ) {
    const ed = getEditor()
    if (!ed) return
    const normalized = normalizeAssetForNode(asset)
    const render = getBehaviorOptions().media.file.render
    ed.chain().focus().insertContent({
      type: 'fileAttachment',
      attrs: {
        href: normalized.url,
        name: normalized.name ?? normalized.url,
        size: normalized.size ?? null,
        mimeType: normalized.mimeType ?? '',
        mediaKind,
        uploadedAt: normalized.uploadedAt ?? '',
        uploadedAtText: formatFileUploadedAt(normalized.uploadedAt, render.uploadedAtFormat),
        duration: normalized.duration ?? null,
        durationText: formatFileDuration(normalized.duration, render.durationFormat),
        fileTypeText: localizedFileTypeText({
          name: normalized.name ?? normalized.url,
          href: normalized.url,
          mimeType: normalized.mimeType ?? '',
          mediaKind,
          fileTypeText: normalized.fileTypeText,
        }),
        showIcon: render.showIcon,
        iconMode: render.iconMode,
        showName: render.showName,
        showSize: render.showSize,
        showMimeType: render.showMimeType,
        showUploadedAt: render.showUploadedAt,
        showDuration: render.showDuration,
        openInNewTab: render.openInNewTab,
        download: render.download,
      },
    }).scrollIntoView().run()
  }

  function insertVideoAsset(asset: UploadedAsset | string) {
    const ed = getEditor()
    if (!ed) return
    const normalized = normalizeAssetForNode(asset)
    const render = getBehaviorOptions().media.video.render
    if (render.displayMode === 'file') {
      insertFileAsset(normalized, 'video')
      return
    }
    const poster = typeof render.poster === 'function'
      ? render.poster(normalized)
      : render.poster ?? normalized.poster ?? ''
    ed.chain().focus().insertContent({
      type: 'video',
      attrs: {
        src: normalized.url,
        name: normalized.name ?? '',
        mimeType: normalized.mimeType ?? '',
        poster,
        duration: normalized.duration ?? null,
        controls: render.controls,
        muted: render.muted,
        loop: render.loop,
        autoplay: render.autoplay,
        playsInline: render.playsInline,
        preload: render.preload,
        allowFullscreen: render.allowFullscreen,
        allowDownload: render.allowDownload,
        allowPictureInPicture: render.allowPictureInPicture,
        width: render.width ?? null,
      },
    }).scrollIntoView().run()
  }

  function insertAudioAsset(asset: UploadedAsset | string) {
    const ed = getEditor()
    if (!ed) return
    const normalized = normalizeAssetForNode(asset)
    const render = getBehaviorOptions().media.audio.render
    if (render.displayMode === 'file') {
      insertFileAsset(normalized, 'audio')
      return
    }
    ed.chain().focus().insertContent({
      type: 'audio',
      attrs: {
        src: normalized.url,
        name: normalized.name ?? '',
        mimeType: normalized.mimeType ?? '',
        duration: normalized.duration ?? null,
        controls: render.controls,
        muted: render.muted,
        loop: render.loop,
        autoplay: render.autoplay,
        preload: render.preload,
        allowDownload: render.allowDownload,
        width: render.width ?? null,
      },
    }).scrollIntoView().run()
  }

  async function uploadAndInsertAsset(
    file: File,
    kind: 'video' | 'audio' | 'file',
    insert: (asset: UploadedAsset) => void,
  ) {
    if (!uploadAsset) return
    const ed = getEditor()
    if (!ed) return
    const mediaOptions = getBehaviorOptions().media[kind]
    const validationFailure = validateAssetFile(file, kind, mediaOptions)
    if (validationFailure) {
      notifyAssetFileValidationFailure({ notify, t }, validationFailure)
      return
    }
    debugLog('upload', 'asset:start', {
      kind,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }, 'info')
    try {
      const result = await uploadAsset(file, kind)
      if (result) {
        const normalized = normalizeUploadedAsset(result, file)
        debugLog('upload', 'asset:success', {
          kind,
          fileName: file.name,
          url: normalized.url,
        }, 'info')
        insert(normalized)
        return
      }
      debugLog('upload', 'asset:error', { kind, fileName: file.name }, 'error')
      notifyAssetUploadFailure(notify, t, kind)
    } catch (error) {
      debugLog('upload', 'asset:error', { kind, fileName: file.name }, 'error', error)
      notifyAssetUploadFailure(notify, t, kind)
    }
  }

  return {
    localizedFileTypeText,
    insertFileAsset,
    insertVideoAsset,
    insertAudioAsset,
    uploadAndInsertAsset,
  }
}

export type MediaInserter = ReturnType<typeof createMediaInserter>
