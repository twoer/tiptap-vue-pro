import type { Editor } from '@tiptap/core'
import type {
  ResolvedEditorAudioRenderOptions,
  ResolvedEditorFileRenderOptions,
  ResolvedEditorVideoRenderOptions,
} from './editorBehaviorOptions'

export type SelectedMediaKind = 'video' | 'audio'

export interface ActiveMediaNode {
  from: number
  to: number
  type: SelectedMediaKind
  attrs: Record<string, unknown>
  src: string
  name: string
}

export function getSelectedMediaNode(editor: Editor): ActiveMediaNode | null {
  const selection = editor.state.selection as {
    from: number
    to: number
    node?: {
      type: { name: string }
      attrs: Record<string, unknown>
    }
  }
  const node = selection.node
  if (!node) return null
  const type = node.type.name
  if (type !== 'video' && type !== 'audio') return null
  const src = String(node.attrs.src ?? '')
  if (!src) return null

  return {
    from: selection.from,
    to: selection.to,
    type,
    attrs: node.attrs,
    src,
    name: String(node.attrs.name || src),
  }
}

export function mediaNodeToFileAttachmentAttrs(
  media: ActiveMediaNode,
  fileRender: ResolvedEditorFileRenderOptions,
) {
  const attrs = media.attrs
  return {
    href: media.src,
    name: attrs.name || media.name,
    mimeType: attrs.mimeType || '',
    mediaKind: media.type,
    duration: attrs.duration ?? null,
    poster: attrs.poster || '',
    controls: attrs.controls ?? true,
    muted: attrs.muted ?? false,
    loop: attrs.loop ?? false,
    autoplay: attrs.autoplay ?? false,
    playsInline: attrs.playsInline ?? true,
    preload: attrs.preload ?? 'metadata',
    allowFullscreen: attrs.allowFullscreen ?? true,
    allowDownload: attrs.allowDownload ?? true,
    allowPictureInPicture: attrs.allowPictureInPicture ?? true,
    width: attrs.width ?? null,
    showIcon: fileRender.showIcon,
    iconMode: fileRender.iconMode,
    showName: fileRender.showName,
    showSize: fileRender.showSize,
    showMimeType: fileRender.showMimeType,
    showUploadedAt: fileRender.showUploadedAt,
    showDuration: fileRender.showDuration,
    openInNewTab: fileRender.openInNewTab,
    download: fileRender.download,
  }
}

export function fileAttachmentToMediaNodeAttrs(
  fileAttrs: Record<string, unknown>,
  type: SelectedMediaKind,
  render: ResolvedEditorVideoRenderOptions | ResolvedEditorAudioRenderOptions,
) {
  const src = String(fileAttrs.href ?? '')
  const base = {
    src,
    name: fileAttrs.name || '',
    mimeType: fileAttrs.mimeType || '',
    duration: fileAttrs.duration ?? null,
    controls: fileAttrs.controls ?? render.controls,
    muted: fileAttrs.muted ?? render.muted,
    loop: fileAttrs.loop ?? render.loop,
    autoplay: fileAttrs.autoplay ?? render.autoplay,
    preload: fileAttrs.preload ?? render.preload,
    allowDownload: fileAttrs.allowDownload ?? render.allowDownload,
    width: fileAttrs.width ?? render.width ?? null,
  }

  if (type === 'audio') return base

  const videoRender = render as ResolvedEditorVideoRenderOptions
  const defaultPoster = typeof videoRender.poster === 'string' ? videoRender.poster : ''
  return {
    ...base,
    poster: fileAttrs.poster || defaultPoster,
    playsInline: fileAttrs.playsInline ?? videoRender.playsInline,
    allowFullscreen: fileAttrs.allowFullscreen ?? videoRender.allowFullscreen,
    allowPictureInPicture: fileAttrs.allowPictureInPicture ?? videoRender.allowPictureInPicture,
  }
}
