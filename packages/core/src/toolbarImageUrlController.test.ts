import { describe, expect, it, vi } from 'vitest'
import { useToolbarImageUrlController } from './toolbarImageUrlController'
import type { ProEditorContext } from './types'

function setup() {
  const setImage = vi.fn()
  const notify = vi.fn()
  const prepareInsert = vi.fn()
  const debugLog = vi.fn()
  const ctx = {
    commands: { setImage },
    notify,
    t: (key: string) => key,
  } as unknown as ProEditorContext
  const controller = useToolbarImageUrlController({
    getContext: () => ctx,
    prepareInsert,
    debugLog,
  })

  return { controller, setImage, notify, prepareInsert, debugLog }
}

describe('useToolbarImageUrlController', () => {
  it('prepares insertion, clears stale input, opens, and logs', () => {
    const { controller, prepareInsert, debugLog } = setup()
    controller.url.value = 'https://stale.example/image.png'

    controller.open()

    expect(prepareInsert).toHaveBeenCalledTimes(1)
    expect(controller.url.value).toBe('')
    expect(controller.visible.value).toBe(true)
    expect(debugLog).toHaveBeenCalledWith(
      'adapter',
      'dialog-open',
      { dialog: 'image-url' },
    )
  })

  it('trims and inserts an HTTPS image URL', () => {
    const { controller, setImage, notify, debugLog } = setup()
    controller.open()
    controller.url.value = '  https://example.com/image.png  '

    expect(controller.confirm()).toBe(true)
    expect(setImage).toHaveBeenCalledWith('https://example.com/image.png')
    expect(notify).not.toHaveBeenCalled()
    expect(controller.visible.value).toBe(false)
    expect(debugLog).toHaveBeenCalledWith(
      'adapter',
      'dialog-confirm',
      { dialog: 'image-url' },
    )
  })

  it('preserves support for relative image URLs', () => {
    const { controller, setImage } = setup()
    controller.open()
    controller.url.value = '/assets/image.png'

    expect(controller.confirm()).toBe(true)
    expect(setImage).toHaveBeenCalledWith('/assets/image.png')
    expect(controller.visible.value).toBe(false)
  })

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,abc',
    'file:///tmp/image.png',
    'ftp://example.com/image.png',
  ])('rejects unsupported image URL %s and keeps the dialog open', (value) => {
    const { controller, setImage, notify } = setup()
    controller.open()
    controller.url.value = value

    expect(controller.confirm()).toBe(false)
    expect(setImage).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('notify.invalidImageUrl', 'warning')
    expect(controller.visible.value).toBe(true)
  })

  it('closes silently when the trimmed URL is empty', () => {
    const { controller, setImage, notify } = setup()
    controller.open()
    controller.url.value = '   '

    expect(controller.confirm()).toBe(true)
    expect(setImage).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    expect(controller.visible.value).toBe(false)
  })
})
