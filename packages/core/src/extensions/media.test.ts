import { describe, expect, it } from 'vitest'
import { AudioExtended, FileAttachment, VideoExtended } from './media'

function attrs(extension: any) {
  return extension.config.addAttributes.call({ parent: () => ({}) })
}

function render(extension: any, HTMLAttributes: Record<string, unknown>) {
  return extension.config.renderHTML({ HTMLAttributes })
}

describe('media extensions', () => {
  it('defines a video node with playback and metadata attributes', () => {
    expect(VideoExtended.name).toBe('video')
    const videoAttrs = attrs(VideoExtended)
    expect(videoAttrs.src.default).toBeNull()
    expect(videoAttrs.name.default).toBe('')
    expect(videoAttrs.mimeType.default).toBe('')
    expect(videoAttrs.poster.default).toBe('')
    expect(videoAttrs.duration.default).toBeNull()
    expect(videoAttrs.width.default).toBeNull()
    expect(videoAttrs.controls.default).toBe(true)
    expect(videoAttrs.allowFullscreen.default).toBe(true)
  })

  it('renders video playback restrictions as reversible HTML attributes', () => {
    const spec = render(VideoExtended, {
      src: 'https://example.com/a.mp4',
      name: 'a.mp4',
      mimeType: 'video/mp4',
      duration: 120,
      controls: false,
      playsInline: true,
      allowFullscreen: false,
      allowDownload: false,
      allowPictureInPicture: false,
    })

    expect(spec[0]).toBe('video')
    expect(spec[1]).toMatchObject({
      src: 'https://example.com/a.mp4',
      'data-name': 'a.mp4',
      'data-mime-type': 'video/mp4',
      'data-duration': 120,
      'data-controls': 'false',
      'data-allow-fullscreen': 'false',
      'data-allow-download': 'false',
      'data-allow-picture-in-picture': 'false',
      controlslist: 'nofullscreen nodownload',
      disablepictureinpicture: '',
    })
  })

  it('defines an audio node with playback and metadata attributes', () => {
    expect(AudioExtended.name).toBe('audio')
    const audioAttrs = attrs(AudioExtended)
    expect(audioAttrs.src.default).toBeNull()
    expect(audioAttrs.name.default).toBe('')
    expect(audioAttrs.mimeType.default).toBe('')
    expect(audioAttrs.duration.default).toBeNull()
    expect(audioAttrs.width.default).toBeNull()
    expect(audioAttrs.controls.default).toBe(true)
    expect(audioAttrs.allowDownload.default).toBe(true)
  })

  it('renders audio download restrictions as reversible HTML attributes', () => {
    const spec = render(AudioExtended, {
      src: 'https://example.com/a.mp3',
      name: 'a.mp3',
      width: 320,
      allowDownload: false,
      controls: true,
    })

    expect(spec[0]).toBe('audio')
    expect(spec[1]).toMatchObject({
      src: 'https://example.com/a.mp3',
      'data-name': 'a.mp3',
      width: 320,
      style: 'width: 320px',
      'data-allow-download': 'false',
      controlslist: 'nodownload',
      controls: '',
    })
  })

  it('uses node views for selectable native media players', () => {
    expect(VideoExtended.config.addNodeView).toBeTypeOf('function')
    expect(AudioExtended.config.addNodeView).toBeTypeOf('function')
  })

  it('defines a file attachment atom node', () => {
    expect(FileAttachment.name).toBe('fileAttachment')
    expect(FileAttachment.config.group).toBe('block')
    expect(FileAttachment.config.atom).toBe(true)
    const fileAttrs = attrs(FileAttachment)
    expect(fileAttrs.mediaKind.default).toBe('file')
    expect(fileAttrs.uploadedAtText.default).toBe('')
    expect(fileAttrs.durationText.default).toBe('')
    expect(fileAttrs.fileTypeText.default).toBe('')
    expect(fileAttrs.showMimeType.default).toBe(false)
    expect(fileAttrs.showDuration.default).toBe(true)
  })

  it('renders file attachment metadata and visibility flags', () => {
    const spec = render(FileAttachment, {
      href: 'https://example.com/report.pdf',
      name: 'report.pdf',
      size: 1024,
      mimeType: 'application/pdf',
      mediaKind: 'file',
      uploadedAt: '2026-06-30T10:20:30.000Z',
      uploadedAtText: '2026-06-30',
      duration: 125,
      durationText: '125s',
      fileTypeText: 'PDF',
      showMimeType: true,
      showUploadedAt: true,
      openInNewTab: false,
      download: false,
    })

    expect(spec[0]).toBe('a')
    expect(spec[1]).toMatchObject({
      href: 'https://example.com/report.pdf',
      class: 'tvp-file-attachment',
      'data-name': 'report.pdf',
      'data-size': 1024,
      'data-mime-type': 'application/pdf',
      'data-uploaded-at-text': '2026-06-30',
      'data-duration': 125,
      'data-duration-text': '125s',
      'data-file-type-text': 'PDF',
      'data-media-kind': 'file',
      'data-show-mime-type': 'true',
      'data-show-uploaded-at': 'true',
      'data-open-in-new-tab': 'false',
      'data-download': 'false',
    })
    expect(JSON.stringify(spec)).toContain('report.pdf')
    expect(JSON.stringify(spec)).toContain('application/pdf')
    expect(JSON.stringify(spec)).toContain('PDF')
    expect(JSON.stringify(spec)).toContain('2026-06-30')
    expect(JSON.stringify(spec)).toContain('125s')
    expect(JSON.stringify(spec)).toContain('lucide-file-icon')
    expect(JSON.stringify(spec)).not.toContain('tvp-file-attachment__download')
  })

  it('renders a file-card download affordance only when download is allowed', () => {
    const allowed = render(FileAttachment, {
      href: 'https://example.com/report.pdf',
      name: 'report.pdf',
      download: true,
    })
    const denied = render(FileAttachment, {
      href: 'https://example.com/report.pdf',
      name: 'report.pdf',
      download: false,
    })

    expect(JSON.stringify(allowed)).toContain('tvp-file-attachment__download')
    expect(JSON.stringify(allowed)).toContain('lucide-download-icon')
    expect(JSON.stringify(denied)).not.toContain('tvp-file-attachment__download')
  })

  it('persists media playback attrs when video/audio are rendered as file cards', () => {
    const spec = render(FileAttachment, {
      href: 'https://example.com/movie.mp4',
      name: 'movie.mp4',
      mimeType: 'video/mp4',
      mediaKind: 'video',
      poster: 'https://example.com/movie.jpg',
      duration: 90,
      controls: false,
      muted: true,
      loop: true,
      autoplay: true,
      playsInline: false,
      preload: 'auto',
      allowFullscreen: false,
      allowDownload: false,
      allowPictureInPicture: false,
      width: 640,
    })

    expect(spec[1]).toMatchObject({
      href: 'https://example.com/movie.mp4',
      'data-media-kind': 'video',
      'data-poster': 'https://example.com/movie.jpg',
      'data-duration': 90,
      'data-media-controls': 'false',
      'data-media-muted': 'true',
      'data-media-loop': 'true',
      'data-media-autoplay': 'true',
      'data-media-plays-inline': 'false',
      'data-media-preload': 'auto',
      'data-media-allow-fullscreen': 'false',
      'data-media-allow-download': 'false',
      'data-media-allow-picture-in-picture': 'false',
      'data-media-width': 640,
    })
  })

  it('detects common file icons from extension and mime type', () => {
    const sheet = render(FileAttachment, {
      href: 'https://example.com/budget.xlsx',
      name: 'budget.xlsx',
      iconMode: 'auto',
    })
    const code = render(FileAttachment, {
      href: 'https://example.com/config.json',
      name: 'config.json',
      mimeType: 'application/json',
      iconMode: 'auto',
    })
    const text = render(FileAttachment, {
      href: 'https://example.com/readme.md',
      name: 'readme.md',
      iconMode: 'auto',
    })
    const slide = render(FileAttachment, {
      href: 'https://example.com/google-io.pptx',
      name: 'google-io.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      iconMode: 'auto',
      showMimeType: true,
    })

    expect(sheet[1]).toMatchObject({ 'data-file-icon': 'sheet' })
    expect(code[1]).toMatchObject({ 'data-file-icon': 'code' })
    expect(text[1]).toMatchObject({ 'data-file-icon': 'text' })
    expect(slide[1]).toMatchObject({ 'data-file-icon': 'slide' })
    expect(JSON.stringify(slide)).toContain('PPT')
  })
})
