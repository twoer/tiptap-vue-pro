import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { resolveEditorBehaviorOptions } from './editorBehaviorOptions'
import { useImageCropController } from './imageCropController'

describe('useImageCropController', () => {
  const scopes: ReturnType<typeof effectScope>[] = []
  let revokeObjectURL: Mock<[url: string], void>

  beforeEach(() => {
    const createObjectURL = vi.fn<[file: File], string>((file) => `blob:${file.name}`)
    revokeObjectURL = vi.fn<[url: string], void>()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    })
  })

  afterEach(() => {
    for (const scope of scopes) scope.stop()
    scopes.length = 0
    vi.restoreAllMocks()
  })

  function setup() {
    const uploadImage = vi.fn(async () => {})
    const notifyCropFailed = vi.fn()
    const debugLog = vi.fn()
    const scope = effectScope()
    scopes.push(scope)
    const controller = scope.run(() => useImageCropController({
      getCropOptions: () => resolveEditorBehaviorOptions({ image: { crop: true } }).image.crop,
      uploadImage,
      notifyCropFailed,
      debugLog,
    }))!
    return { controller, uploadImage, notifyCropFailed, debugLog, scope }
  }

  it('processes queued files in order and revokes each preview URL', async () => {
    const { controller, uploadImage } = setup()
    const first = new File(['a'], 'a.png', { type: 'image/png' })
    const second = new File(['b'], 'b.png', { type: 'image/png' })

    controller.openQueue([first, second])

    expect(controller.visible.value).toBe(true)
    expect(controller.currentFile.value).toBe(first)
    expect(controller.objectUrl.value).toBe('blob:a.png')

    await controller.skip()

    expect(uploadImage).toHaveBeenNthCalledWith(1, first)
    expect(controller.currentFile.value).toBe(second)
    expect(controller.objectUrl.value).toBe('blob:b.png')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:a.png')

    await controller.skip()

    expect(uploadImage).toHaveBeenNthCalledWith(2, second)
    expect(controller.visible.value).toBe(false)
    expect(controller.currentFile.value).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:b.png')
  })

  it('clamps drag movement to the zoomed preview bounds', () => {
    const { controller } = setup()
    const preview = document.createElement('div')
    preview.getBoundingClientRect = () => ({
      width: 200,
      height: 100,
    } as DOMRect)
    controller.preview.value = preview
    controller.zoom.value = 2

    controller.onPointerDown({
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent)
    controller.onPointerMove({
      pointerId: 1,
      pointerType: 'touch',
      clientX: 150,
      clientY: 80,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent)

    expect(controller.pan.value).toEqual({ x: 100, y: 50 })
    expect(controller.imageStyle.value.transform).toBe('translate(100px, 50px) scale(2)')

    controller.onPointerUp({ pointerId: 1 } as PointerEvent)
  })

  it('reports crop failures and falls back to uploading the original file', async () => {
    const { controller, uploadImage, notifyCropFailed, debugLog } = setup()
    const file = new File(['a'], 'a.png', { type: 'image/png' })
    const cropError = new Error('image decode failed')
    controller.openQueue([file])
    controller.image.value = {
      get naturalWidth() {
        throw cropError
      },
    } as unknown as HTMLImageElement

    await controller.confirm()

    expect(notifyCropFailed).toHaveBeenCalledTimes(1)
    expect(uploadImage).toHaveBeenCalledWith(file)
    expect(debugLog).toHaveBeenCalledWith(
      'upload',
      'image-crop:error',
      { fileName: 'a.png' },
      'error',
      cropError,
    )
    expect(controller.visible.value).toBe(false)
  })

  it('releases the active preview URL when its scope is disposed', () => {
    const { controller, scope } = setup()
    controller.openQueue([new File(['a'], 'a.png', { type: 'image/png' })])

    scope.stop()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:a.png')
  })
})
