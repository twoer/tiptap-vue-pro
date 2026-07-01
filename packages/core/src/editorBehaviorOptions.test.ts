import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EDITOR_BEHAVIOR_OPTIONS,
  resolveEditorBehaviorOptions,
} from './editorBehaviorOptions'

describe('editor behavior options', () => {
  it('resolves default behavior options', () => {
    expect(resolveEditorBehaviorOptions()).toEqual(DEFAULT_EDITOR_BEHAVIOR_OPTIONS)
  })

  it('allows partial overrides without replacing unrelated defaults', () => {
    const options = resolveEditorBehaviorOptions({
      link: { defaultTarget: '_self' },
      image: { accept: 'image/png,image/jpeg', maxSize: 1024, multiple: true, allowUrl: false },
      media: {
        video: {
          accept: 'video/mp4',
          multiple: true,
          render: {
            displayMode: 'file',
            allowDownload: false,
          },
        },
        audio: {
          multiple: true,
        },
        file: {
          multiple: true,
          render: {
            showUploadedAt: true,
            showMimeType: true,
          },
        },
      },
      feedback: {
        elementToolbarSuccess: false,
      },
    })

    expect(options.link.defaultTarget).toBe('_self')
    expect(options.image.accept).toBe('image/png,image/jpeg')
    expect(options.image.maxSize).toBe(1024)
    expect(options.image.multiple).toBe(true)
    expect(options.image.allowUrl).toBe(false)
    expect(options.table).toEqual(DEFAULT_EDITOR_BEHAVIOR_OPTIONS.table)
    expect(options.media.video.accept).toBe('video/mp4')
    expect(options.media.video.multiple).toBe(true)
    expect(options.media.video.render.displayMode).toBe('file')
    expect(options.media.video.render.allowDownload).toBe(false)
    expect(options.media.video.render.controls).toBe(true)
    expect(options.media.audio.accept).toBe(DEFAULT_EDITOR_BEHAVIOR_OPTIONS.media.audio.accept)
    expect(options.media.audio.multiple).toBe(true)
    expect(options.media.audio.render).toEqual(DEFAULT_EDITOR_BEHAVIOR_OPTIONS.media.audio.render)
    expect(options.media.file.multiple).toBe(true)
    expect(options.media.file.render.showUploadedAt).toBe(true)
    expect(options.media.file.render.showMimeType).toBe(true)
    expect(options.media.file.render.showSize).toBe(true)
    expect(options.feedback.elementToolbarSuccess).toBe(false)
  })

  it('preserves explicit false for table header rows', () => {
    expect(resolveEditorBehaviorOptions({
      table: { withHeaderRow: false },
    }).table.withHeaderRow).toBe(false)
  })
})
