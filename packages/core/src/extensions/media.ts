import { mergeAttributes, Node } from '@tiptap/core'
import { NodeSelection, Plugin } from '@tiptap/pm/state'
import { formatFileSize } from '../handleImageUpload'
import { createMediaNodeView } from './mediaNodeView'

type MediaKind = 'video' | 'audio' | 'file'
type LucideIconNode = [string, Record<string, string>]

export interface FileAttachmentOptions {
  fileTypeLabel?: (attrs: Record<string, unknown>) => string
}

const LUCIDE_DOWNLOAD_ICON_NODES: LucideIconNode[] = [
  ['path', { d: 'M12 15V3' }],
  ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }],
  ['path', { d: 'm7 10 5 5 5-5' }],
]

const LUCIDE_FILE_ICON_NODES: Record<string, LucideIconNode[]> = {
  file: [
    ['path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
  ],
  text: [
    ['path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['path', { d: 'M10 9H8' }],
    ['path', { d: 'M16 13H8' }],
    ['path', { d: 'M16 17H8' }],
  ],
  image: [
    ['path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['circle', { cx: '10', cy: '12', r: '2' }],
    ['path', { d: 'm20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22' }],
  ],
  video: [
    ['path', { d: 'M4 12V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['path', { d: 'm10 17.843 3.033-1.755a.64.64 0 0 1 .967.56v4.704a.65.65 0 0 1-.967.56L10 20.157' }],
    ['rect', { width: '7', height: '6', x: '3', y: '16', rx: '1' }],
  ],
  audio: [
    ['path', { d: 'M11.65 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v10.35' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['path', { d: 'M8 20v-7l3 1.474' }],
    ['circle', { cx: '6', cy: '20', r: '2' }],
  ],
  archive: [
    ['path', { d: 'M13.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v11.5' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['path', { d: 'M8 12v-1' }],
    ['path', { d: 'M8 18v-2' }],
    ['path', { d: 'M8 7V6' }],
    ['circle', { cx: '8', cy: '20', r: '2' }],
  ],
  code: [
    ['path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['path', { d: 'M10 12.5 8 15l2 2.5' }],
    ['path', { d: 'm14 12.5 2 2.5-2 2.5' }],
  ],
  sheet: [
    ['path', { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' }],
    ['path', { d: 'M14 2v5a1 1 0 0 0 1 1h5' }],
    ['path', { d: 'M8 13h2' }],
    ['path', { d: 'M14 13h2' }],
    ['path', { d: 'M8 17h2' }],
    ['path', { d: 'M14 17h2' }],
  ],
  slide: [
    ['path', { d: 'M2 3h20' }],
    ['path', { d: 'M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3' }],
    ['path', { d: 'm7 21 5-5 5 5' }],
  ],
}

function parseBooleanAttr(
  el: HTMLElement,
  attr: string,
  fallback: boolean,
): boolean {
  const value = el.getAttribute(attr)
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function renderBooleanDataAttr(name: string, value: unknown, fallback: boolean) {
  return value === fallback ? {} : { [name]: String(Boolean(value)) }
}

function parseNumberAttr(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parseWidthAttr(el: HTMLElement): number | null {
  return parseNumberAttr(el.getAttribute('width'))
    ?? parseNumberAttr((el.style.width || '').replace(/px$/, ''))
}

function appendStyle(style: unknown, value: string) {
  const base = typeof style === 'string' ? style.trim().replace(/;$/, '') : ''
  return base ? `${base}; ${value}` : value
}

function cssWidthValue(width: unknown) {
  if (typeof width === 'number' && Number.isFinite(width) && width > 0) return `${width}px`
  if (typeof width === 'string' && width.trim()) return width.trim()
  return ''
}

function controlsListIncludes(el: HTMLElement, token: string): boolean {
  return (el.getAttribute('controlslist') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .includes(token)
}

function buildControlsList(attrs: Record<string, unknown>) {
  return [
    attrs.allowFullscreen === false ? 'nofullscreen' : '',
    attrs.allowDownload === false ? 'nodownload' : '',
  ].filter(Boolean).join(' ')
}

function addBooleanHtmlAttr(
  attrs: Record<string, unknown>,
  attrName: string,
  enabled: unknown,
) {
  if (enabled) attrs[attrName] = ''
  else delete attrs[attrName]
}

function normalizeUploadedAt(value: unknown): string {
  if (value == null || value === '') return ''
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function formatUploadedAt(value: unknown): string {
  const normalized = normalizeUploadedAt(value)
  if (!normalized) return ''
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return normalized
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDuration(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return ''
  const totalSeconds = Math.round(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`
}

export function detectFileAttachmentIcon(attrs: Record<string, unknown>): string {
  const iconMode = attrs.iconMode
  if (iconMode === 'none') return 'none'
  if (iconMode === 'file') return 'file'
  const mediaKind = attrs.mediaKind
  if (mediaKind === 'video' || mediaKind === 'audio') return mediaKind
  const mimeType = String(attrs.mimeType ?? '')
  if (mimeType.includes('/pdf')) return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('msword')) return 'doc'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'sheet'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'slide'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.includes('json') || mimeType === 'application/xml' || mimeType.endsWith('+xml')) return 'code'
  if (mimeType.startsWith('text/')) return 'text'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'archive'
  const name = String(attrs.name ?? attrs.href ?? '').toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(name)) return 'image'
  if (/\.(mp4|webm|mov|m4v)$/.test(name)) return 'video'
  if (/\.(mp3|wav|ogg|m4a)$/.test(name)) return 'audio'
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return 'archive'
  if (/\.(docx?|pages)$/.test(name)) return 'doc'
  if (/\.(xlsx?|numbers|csv)$/.test(name)) return 'sheet'
  if (/\.(pptx?|key)$/.test(name)) return 'slide'
  if (/\.(txt|md|markdown|rtf|log)$/.test(name)) return 'text'
  if (/\.(js|jsx|ts|tsx|vue|html?|css|scss|less|json|xml|ya?ml|toml|ini|sh|py|java|go|rs|php|rb|c|cpp|h)$/.test(name)) return 'code'
  return 'file'
}

function fileTypeLabel(attrs: Record<string, unknown>): string {
  const iconKey = detectFileAttachmentIcon(attrs)
  const fileTypeText = String(attrs.fileTypeText ?? '')
  if (fileTypeText) return fileTypeText
  const name = String(attrs.name ?? attrs.href ?? '').toLowerCase()
  if (iconKey === 'pdf') return 'PDF'
  if (iconKey === 'doc') return 'Word'
  if (iconKey === 'sheet') return name.endsWith('.csv') ? 'CSV' : 'Excel'
  if (iconKey === 'slide') return 'PPT'
  if (iconKey === 'archive') return '压缩包'
  if (iconKey === 'image') return '图片'
  if (iconKey === 'video') return '视频'
  if (iconKey === 'audio') return '音频'
  if (iconKey === 'text') return '文本'
  if (iconKey === 'code') return '代码'
  const mimeType = String(attrs.mimeType ?? '')
  const subtype = mimeType.split('/')[1]?.split(';')[0]
  return subtype ? subtype.toUpperCase() : '文件'
}

function fileMetaParts(attrs: Record<string, unknown>, options: FileAttachmentOptions = {}) {
  const parts: string[] = []
  if (attrs.showSize !== false && typeof attrs.size === 'number') {
    parts.push(formatFileSize(attrs.size))
  }
  if (attrs.showMimeType === true) {
    const label = options.fileTypeLabel?.(attrs) || fileTypeLabel(attrs)
    if (label) parts.push(label)
  }
  if (attrs.showDuration !== false) {
    const duration = attrs.durationText
      ? String(attrs.durationText)
      : formatDuration(attrs.duration)
    if (duration) parts.push(duration)
  }
  if (attrs.showUploadedAt === true) {
    const uploadedAt = attrs.uploadedAtText
      ? String(attrs.uploadedAtText)
      : formatUploadedAt(attrs.uploadedAt)
    if (uploadedAt) parts.push(uploadedAt)
  }
  return parts
}

function lucideFileIconSpec(iconKey: string) {
  const iconNode = LUCIDE_FILE_ICON_NODES[iconKey] ?? LUCIDE_FILE_ICON_NODES.file
  return [
    'svg',
    {
      class: 'tvp-file-attachment__svg lucide lucide-file-icon',
      xmlns: 'http://www.w3.org/2000/svg',
      width: '18',
      height: '18',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    ...iconNode,
  ]
}

function lucideDownloadIconSpec() {
  return [
    'svg',
    {
      class: 'tvp-file-attachment__download-svg lucide lucide-download-icon',
      xmlns: 'http://www.w3.org/2000/svg',
      width: '16',
      height: '16',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    ...LUCIDE_DOWNLOAD_ICON_NODES,
  ]
}

function dataAttrsForFile(attrs: Record<string, unknown>) {
  return {
    'data-name': attrs.name || undefined,
    'data-size': attrs.size ?? undefined,
    'data-mime-type': attrs.mimeType || undefined,
    'data-poster': attrs.poster || undefined,
    'data-media-preload': attrs.preload || undefined,
    'data-media-width': attrs.width ?? undefined,
    'data-uploaded-at': normalizeUploadedAt(attrs.uploadedAt),
    'data-uploaded-at-text': attrs.uploadedAtText || undefined,
    'data-duration': attrs.duration ?? undefined,
    'data-duration-text': attrs.durationText || undefined,
    'data-media-kind': attrs.mediaKind || 'file',
    'data-icon-mode': attrs.iconMode || 'auto',
    'data-file-icon': detectFileAttachmentIcon(attrs),
    'data-file-type-text': attrs.fileTypeText || undefined,
    ...renderBooleanDataAttr('data-show-icon', attrs.showIcon, true),
    ...renderBooleanDataAttr('data-show-name', attrs.showName, true),
    ...renderBooleanDataAttr('data-show-size', attrs.showSize, true),
    ...renderBooleanDataAttr('data-show-mime-type', attrs.showMimeType, false),
    ...renderBooleanDataAttr('data-show-uploaded-at', attrs.showUploadedAt, false),
    ...renderBooleanDataAttr('data-show-duration', attrs.showDuration, true),
    ...renderBooleanDataAttr('data-open-in-new-tab', attrs.openInNewTab, true),
    ...renderBooleanDataAttr('data-download', attrs.download, true),
    ...renderBooleanDataAttr('data-media-controls', attrs.controls, true),
    ...renderBooleanDataAttr('data-media-muted', attrs.muted, false),
    ...renderBooleanDataAttr('data-media-loop', attrs.loop, false),
    ...renderBooleanDataAttr('data-media-autoplay', attrs.autoplay, false),
    ...renderBooleanDataAttr('data-media-plays-inline', attrs.playsInline, true),
    ...renderBooleanDataAttr('data-media-allow-fullscreen', attrs.allowFullscreen, true),
    ...renderBooleanDataAttr('data-media-allow-download', attrs.allowDownload, true),
    ...renderBooleanDataAttr('data-media-allow-picture-in-picture', attrs.allowPictureInPicture, true),
  }
}

function fileRenderContent(attrs: Record<string, unknown>, options: FileAttachmentOptions = {}) {
  const name = String(attrs.name || attrs.href || 'file')
  const meta = fileMetaParts(attrs, options)
  const body: unknown[] = ['span', { class: 'tvp-file-attachment__body' }]
  if (attrs.showName !== false) {
    body.push(['span', { class: 'tvp-file-attachment__name' }, name])
  }
  if (meta.length > 0) {
    body.push(['span', { class: 'tvp-file-attachment__meta' }, meta.join(' · ')])
  }
  const children: unknown[] = []
  if (attrs.showIcon !== false && attrs.iconMode !== 'none') {
    const iconKey = detectFileAttachmentIcon(attrs)
    children.push([
      'span',
      { class: 'tvp-file-attachment__icon', 'aria-hidden': 'true' },
      lucideFileIconSpec(iconKey),
    ])
  }
  children.push(body)
  if (attrs.download !== false) {
    children.push([
      'span',
      {
        class: 'tvp-file-attachment__download',
        'data-file-download-action': 'true',
        title: 'Download',
        'aria-label': 'Download file',
      },
      lucideDownloadIconSpec(),
    ])
  }
  return children
}

function getFileAttachmentClickTarget(event: Event) {
  const target = event.target
  return target instanceof Element
    ? target.closest('a.tvp-file-attachment')
    : null
}

function getFileAttachmentDownloadTarget(event: Event) {
  const target = event.target
  return target instanceof Element
    ? target.closest('.tvp-file-attachment__download')
    : null
}

function triggerFileAttachmentDownload(href: unknown, name: unknown) {
  if (!href) return
  const anchor = document.createElement('a')
  anchor.href = String(href)
  anchor.download = String(name || '')
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export const VideoExtended = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-name') ?? '',
      },
      mimeType: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-mime-type') ?? '',
      },
      poster: {
        default: '',
        parseHTML: (el) => el.getAttribute('poster') ?? '',
      },
      duration: {
        default: null,
        parseHTML: (el) => parseNumberAttr(el.getAttribute('data-duration')),
      },
      width: {
        default: null,
        parseHTML: (el) => parseWidthAttr(el),
      },
      controls: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-controls', el.hasAttribute('controls')),
      },
      muted: {
        default: false,
        parseHTML: (el) => el.hasAttribute('muted'),
      },
      loop: {
        default: false,
        parseHTML: (el) => el.hasAttribute('loop'),
      },
      autoplay: {
        default: false,
        parseHTML: (el) => el.hasAttribute('autoplay'),
      },
      playsInline: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-plays-inline', el.hasAttribute('playsinline')),
      },
      preload: {
        default: 'metadata',
        parseHTML: (el) => el.getAttribute('preload') ?? 'metadata',
      },
      allowFullscreen: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-allow-fullscreen', !controlsListIncludes(el, 'nofullscreen')),
      },
      allowDownload: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-allow-download', !controlsListIncludes(el, 'nodownload')),
      },
      allowPictureInPicture: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-allow-picture-in-picture', !el.hasAttribute('disablepictureinpicture')),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'video[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes }
    if (attrs.name) attrs['data-name'] = attrs.name
    if (attrs.mimeType) attrs['data-mime-type'] = attrs.mimeType
    if (attrs.duration != null) attrs['data-duration'] = attrs.duration
    const controlsList = buildControlsList(attrs)
    if (controlsList) attrs.controlslist = controlsList
    if (attrs.allowPictureInPicture === false) attrs.disablepictureinpicture = ''
    if (attrs.playsInline) attrs.playsinline = ''
    addBooleanHtmlAttr(attrs, 'controls', attrs.controls)
    addBooleanHtmlAttr(attrs, 'muted', attrs.muted)
    addBooleanHtmlAttr(attrs, 'loop', attrs.loop)
    addBooleanHtmlAttr(attrs, 'autoplay', attrs.autoplay)
    Object.assign(attrs, {
      ...renderBooleanDataAttr('data-controls', attrs.controls, true),
      ...renderBooleanDataAttr('data-plays-inline', attrs.playsInline, true),
      ...renderBooleanDataAttr('data-allow-fullscreen', attrs.allowFullscreen, true),
      ...renderBooleanDataAttr('data-allow-download', attrs.allowDownload, true),
      ...renderBooleanDataAttr('data-allow-picture-in-picture', attrs.allowPictureInPicture, true),
    })
    delete attrs.name
    delete attrs.mimeType
    delete attrs.duration
    delete attrs.allowFullscreen
    delete attrs.allowDownload
    delete attrs.allowPictureInPicture
    delete attrs.playsInline
    return ['video', mergeAttributes(attrs)]
  },

  addNodeView() {
    return ({ node, getPos, HTMLAttributes, editor }) => createMediaNodeView({
      node,
      getPos,
      HTMLAttributes,
      editor,
    } as never)
  },
})

export const AudioExtended = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-name') ?? '',
      },
      mimeType: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-mime-type') ?? '',
      },
      duration: {
        default: null,
        parseHTML: (el) => parseNumberAttr(el.getAttribute('data-duration')),
      },
      width: {
        default: null,
        parseHTML: (el) => parseWidthAttr(el),
      },
      controls: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-controls', el.hasAttribute('controls')),
      },
      muted: {
        default: false,
        parseHTML: (el) => el.hasAttribute('muted'),
      },
      loop: {
        default: false,
        parseHTML: (el) => el.hasAttribute('loop'),
      },
      autoplay: {
        default: false,
        parseHTML: (el) => el.hasAttribute('autoplay'),
      },
      preload: {
        default: 'metadata',
        parseHTML: (el) => el.getAttribute('preload') ?? 'metadata',
      },
      allowDownload: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-allow-download', !controlsListIncludes(el, 'nodownload')),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'audio[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes }
    if (attrs.name) attrs['data-name'] = attrs.name
    if (attrs.mimeType) attrs['data-mime-type'] = attrs.mimeType
    if (attrs.duration != null) attrs['data-duration'] = attrs.duration
    const widthStyle = cssWidthValue(attrs.width)
    if (widthStyle) attrs.style = appendStyle(attrs.style, `width: ${widthStyle}`)
    if (attrs.allowDownload === false) attrs.controlslist = 'nodownload'
    addBooleanHtmlAttr(attrs, 'controls', attrs.controls)
    addBooleanHtmlAttr(attrs, 'muted', attrs.muted)
    addBooleanHtmlAttr(attrs, 'loop', attrs.loop)
    addBooleanHtmlAttr(attrs, 'autoplay', attrs.autoplay)
    Object.assign(attrs, {
      ...renderBooleanDataAttr('data-controls', attrs.controls, true),
      ...renderBooleanDataAttr('data-allow-download', attrs.allowDownload, true),
    })
    delete attrs.name
    delete attrs.mimeType
    delete attrs.duration
    delete attrs.allowDownload
    return ['audio', mergeAttributes(attrs)]
  },

  addNodeView() {
    return ({ node, getPos, HTMLAttributes, editor }) => createMediaNodeView({
      node,
      getPos,
      HTMLAttributes,
      editor,
    } as never)
  },
})

export const FileAttachment = Node.create<FileAttachmentOptions>({
  name: 'fileAttachment',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {}
  },

  addAttributes() {
    return {
      href: { default: null },
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-name') ?? el.textContent?.trim() ?? '',
      },
      size: {
        default: null,
        parseHTML: (el) => parseNumberAttr(el.getAttribute('data-size')),
      },
      mimeType: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-mime-type') ?? '',
      },
      poster: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-poster') ?? '',
      },
      mediaKind: {
        default: 'file' as MediaKind,
        parseHTML: (el) => (el.getAttribute('data-media-kind') as MediaKind) || 'file',
      },
      uploadedAt: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-uploaded-at') ?? '',
      },
      uploadedAtText: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-uploaded-at-text') ?? '',
      },
      duration: {
        default: null,
        parseHTML: (el) => parseNumberAttr(el.getAttribute('data-duration')),
      },
      durationText: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-duration-text') ?? '',
      },
      fileTypeText: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-file-type-text') ?? '',
      },
      showIcon: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-show-icon', true),
      },
      iconMode: {
        default: 'auto',
        parseHTML: (el) => el.getAttribute('data-icon-mode') ?? 'auto',
      },
      showName: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-show-name', true),
      },
      showSize: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-show-size', true),
      },
      showMimeType: {
        default: false,
        parseHTML: (el) => parseBooleanAttr(el, 'data-show-mime-type', false),
      },
      showUploadedAt: {
        default: false,
        parseHTML: (el) => parseBooleanAttr(el, 'data-show-uploaded-at', false),
      },
      showDuration: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-show-duration', true),
      },
      openInNewTab: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-open-in-new-tab', el.getAttribute('target') === '_blank'),
      },
      download: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-download', el.hasAttribute('download')),
      },
      controls: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-media-controls', true),
      },
      muted: {
        default: false,
        parseHTML: (el) => parseBooleanAttr(el, 'data-media-muted', false),
      },
      loop: {
        default: false,
        parseHTML: (el) => parseBooleanAttr(el, 'data-media-loop', false),
      },
      autoplay: {
        default: false,
        parseHTML: (el) => parseBooleanAttr(el, 'data-media-autoplay', false),
      },
      playsInline: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-media-plays-inline', true),
      },
      preload: {
        default: 'metadata',
        parseHTML: (el) => el.getAttribute('data-media-preload') ?? 'metadata',
      },
      allowFullscreen: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-media-allow-fullscreen', true),
      },
      allowDownload: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-media-allow-download', true),
      },
      allowPictureInPicture: {
        default: true,
        parseHTML: (el) => parseBooleanAttr(el, 'data-media-allow-picture-in-picture', true),
      },
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-media-width') ?? null,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a.tvp-file-attachment[href]' }]
  },

  addProseMirrorPlugins() {
    const nodeName = this.name
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            click(view, event) {
              if (!view.editable) return false
              const target = getFileAttachmentClickTarget(event)
              if (!target) return false

              const nodePos = view.posAtDOM(target, 0)
              const node = view.state.doc.nodeAt(nodePos)
              if (node?.type.name !== nodeName) {
                return false
              }

              event.preventDefault()
              event.stopPropagation()
              if (getFileAttachmentDownloadTarget(event) && node.attrs.download !== false) {
                triggerFileAttachmentDownload(node.attrs.href, node.attrs.name)
                return true
              }

              view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)))
              view.focus()
              return true
            },
          },
          handleClickOn(view, _pos, node, nodePos, event) {
            if (!view.editable || node.type.name !== nodeName || !getFileAttachmentClickTarget(event)) {
              return false
            }

            event.preventDefault()
            event.stopPropagation()
            if (getFileAttachmentDownloadTarget(event) && node.attrs.download !== false) {
              triggerFileAttachmentDownload(node.attrs.href, node.attrs.name)
              return true
            }

            view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)))
            view.focus()
            return true
          },
        },
      }),
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes }
    const linkAttrs = {
      href: attrs.href,
      class: 'tvp-file-attachment',
      target: attrs.openInNewTab ? '_blank' : undefined,
      rel: attrs.openInNewTab ? 'noopener noreferrer' : undefined,
      download: attrs.download ? attrs.name || undefined : undefined,
      ...dataAttrsForFile(attrs),
    }
    return ['a', mergeAttributes(linkAttrs), ...fileRenderContent(attrs, this.options)]
  },
})
