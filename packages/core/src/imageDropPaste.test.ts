import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { useImageDropPaste } from './imageDropPaste'
import type { ProEditorContext } from './types'

function imageFile() {
  return new File(['x'], 'x.png', { type: 'image/png' })
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
})
