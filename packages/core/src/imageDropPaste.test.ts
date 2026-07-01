import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { useImageDropPaste } from './imageDropPaste'
import { ZH_CN_LOCALE_MESSAGES } from './locale'
import type { ProEditorContext } from './types'

function imageFile() {
  return new File(['x'], 'x.png', { type: 'image/png' })
}

function imageFileWithSize(size: number) {
  return new File([new Uint8Array(size)], 'x.png', { type: 'image/png' })
}

function createEditor() {
  const chainApi = {
    focus: vi.fn(),
    setImage: vi.fn(),
    run: vi.fn(),
  }
  chainApi.focus.mockReturnValue(chainApi)
  chainApi.setImage.mockReturnValue(chainApi)
  chainApi.run.mockReturnValue(true)
  return {
    chain: vi.fn(() => chainApi),
    chainApi,
  }
}

function createCtx(editor: unknown) {
  return {
    editor: shallowRef(editor),
    notify: vi.fn(),
    t: (key: keyof typeof ZH_CN_LOCALE_MESSAGES, params?: Record<string, string | number>) => {
      let message = ZH_CN_LOCALE_MESSAGES[key]
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          message = message.replace(`{${name}}`, String(value)) as typeof message
        }
      }
      return message
    },
  } as unknown as ProEditorContext
}

describe('useImageDropPaste', () => {
  it('does not consume image files before editor is ready', () => {
    const upload = vi.fn()
    const ctx = createCtx(undefined)
    const { onPaste } = useImageDropPaste(ctx, () => upload)
    const preventDefault = vi.fn()

    onPaste({
      clipboardData: { files: [imageFile()] },
      preventDefault,
    } as unknown as ClipboardEvent)

    expect(preventDefault).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('prevents default and uploads image files when editor is ready', async () => {
    const upload = vi.fn(async () => 'https://example.com/x.png')
    const editor = createEditor()
    const ctx = createCtx(editor)
    const { onDrop } = useImageDropPaste(ctx, () => upload)
    const preventDefault = vi.fn()

    onDrop({
      dataTransfer: { files: [imageFile()] },
      preventDefault,
    } as unknown as DragEvent)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(editor.chainApi.setImage).toHaveBeenCalledWith({ src: 'https://example.com/x.png' })
  })

  it('prevents default but does not upload images larger than maxSize', async () => {
    const upload = vi.fn(async () => 'https://example.com/x.png')
    const editor = createEditor()
    const ctx = createCtx(editor)
    const { onDrop } = useImageDropPaste(ctx, () => upload, () => ({
      image: { maxSize: 1024 },
    }))
    const preventDefault = vi.fn()

    onDrop({
      dataTransfer: { files: [imageFileWithSize(2048)] },
      preventDefault,
    } as unknown as DragEvent)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(upload).not.toHaveBeenCalled()
    expect(editor.chainApi.setImage).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('图片过大(2.0 KB),上限 1.0 KB', 'warning')
  })
})
