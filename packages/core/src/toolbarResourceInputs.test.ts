import { describe, expect, it, vi } from 'vitest'
import { useToolbarResourceInputs } from './toolbarResourceInputs'

function inputWithFiles(files: File[]) {
  const input = document.createElement('input')
  input.type = 'file'
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  })
  Object.defineProperty(input, 'value', {
    configurable: true,
    writable: true,
    value: 'selected',
  })
  return input
}

function setup(overrides: Partial<Parameters<typeof useToolbarResourceInputs>[0]> = {}) {
  const prepareInsert = vi.fn()
  const openImageCrop = vi.fn()
  const uploadImage = vi.fn(async (_file: File) => {})
  const uploadVideo = vi.fn(async (_file: File) => {})
  const uploadFile = vi.fn(async (_file: File) => {})
  const controller = useToolbarResourceInputs({
    prepareInsert,
    getImageMultiple: () => true,
    getVideoMultiple: () => true,
    getFileMultiple: () => true,
    isImageCropEnabled: () => false,
    openImageCrop,
    uploadImage,
    uploadVideo,
    uploadFile,
    ...overrides,
  })

  return {
    controller,
    prepareInsert,
    openImageCrop,
    uploadImage,
    uploadVideo,
    uploadFile,
  }
}

describe('useToolbarResourceInputs', () => {
  it('prepares insertion before opening each file input', () => {
    const { controller, prepareInsert } = setup()
    const imageInput = document.createElement('input')
    const videoInput = document.createElement('input')
    const fileInput = document.createElement('input')
    const order: string[] = []

    prepareInsert.mockImplementation(() => order.push('prepare'))
    vi.spyOn(imageInput, 'click').mockImplementation(() => order.push('image'))
    vi.spyOn(videoInput, 'click').mockImplementation(() => order.push('video'))
    vi.spyOn(fileInput, 'click').mockImplementation(() => order.push('file'))
    controller.imageInput.value = imageInput
    controller.videoInput.value = videoInput
    controller.fileInput.value = fileInput

    controller.triggerImageUpload()
    controller.triggerVideoUpload()
    controller.triggerFileUpload()

    expect(order).toEqual([
      'prepare', 'image',
      'prepare', 'video',
      'prepare', 'file',
    ])
  })

  it('routes selected images to crop when crop is enabled', async () => {
    const first = new File(['a'], 'a.png', { type: 'image/png' })
    const second = new File(['b'], 'b.png', { type: 'image/png' })
    const { controller, openImageCrop, uploadImage } = setup({
      isImageCropEnabled: () => true,
    })
    const input = inputWithFiles([first, second])

    await controller.onImageSelected({ target: input } as unknown as Event)

    expect(openImageCrop).toHaveBeenCalledWith([first, second])
    expect(uploadImage).not.toHaveBeenCalled()
  })

  it('uploads only the first selected file when multiple is false', async () => {
    const first = new File(['a'], 'a.png', { type: 'image/png' })
    const second = new File(['b'], 'b.png', { type: 'image/png' })
    const { controller, uploadImage } = setup({
      getImageMultiple: () => false,
    })

    await controller.onImageSelected({
      target: inputWithFiles([first, second]),
    } as unknown as Event)

    expect(uploadImage).toHaveBeenCalledTimes(1)
    expect(uploadImage).toHaveBeenCalledWith(first)
  })

  it('uploads selected files sequentially when multiple is true', async () => {
    const first = new File(['a'], 'a.mp4', { type: 'video/mp4' })
    const second = new File(['b'], 'b.mp4', { type: 'video/mp4' })
    let releaseFirst: (() => void) | undefined
    const firstUpload = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const uploadVideo = vi.fn((file: File) => (
      file === first ? firstUpload : Promise.resolve()
    ))
    const { controller } = setup({ uploadVideo })

    const pending = controller.onVideoSelected({
      target: inputWithFiles([first, second]),
    } as unknown as Event)
    await Promise.resolve()

    expect(uploadVideo).toHaveBeenCalledTimes(1)
    expect(uploadVideo).toHaveBeenCalledWith(first)

    releaseFirst?.()
    await pending

    expect(uploadVideo).toHaveBeenNthCalledWith(2, second)
  })

  it('clears each native input before asynchronous uploads finish', async () => {
    let releaseUpload: (() => void) | undefined
    const pendingUpload = new Promise<void>((resolve) => {
      releaseUpload = resolve
    })
    const uploadFile = vi.fn(() => pendingUpload)
    const { controller } = setup({ uploadFile })
    const input = inputWithFiles([
      new File(['a'], 'a.pdf', { type: 'application/pdf' }),
    ])
    const pending = controller.onFileSelected({ target: input } as unknown as Event)

    expect(input.value).toBe('')
    releaseUpload?.()
    await pending
  })

  it('preserves the original File object passed to upload callbacks', async () => {
    const original = new File(['payload'], 'report.pdf', { type: 'application/pdf' })
    const { controller, uploadFile } = setup()

    await controller.onFileSelected({
      target: inputWithFiles([original]),
    } as unknown as Event)

    expect(uploadFile.mock.calls[0]?.[0]).toBe(original)
  })
})
