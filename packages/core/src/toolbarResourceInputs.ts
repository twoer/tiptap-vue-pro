import { shallowRef } from 'vue'

export interface ToolbarResourceInputsOptions {
  prepareInsert: () => void
  getImageMultiple: () => boolean
  getVideoMultiple: () => boolean
  getFileMultiple: () => boolean
  isImageCropEnabled: () => boolean
  openImageCrop: (files: File[]) => void
  uploadImage: (file: File) => Promise<void>
  uploadVideo: (file: File) => Promise<void>
  uploadFile: (file: File) => Promise<void>
}

export function useToolbarResourceInputs(options: ToolbarResourceInputsOptions) {
  const imageInput = shallowRef<HTMLInputElement | null>(null)
  const videoInput = shallowRef<HTMLInputElement | null>(null)
  const fileInput = shallowRef<HTMLInputElement | null>(null)

  function triggerInput(input: HTMLInputElement | null) {
    options.prepareInsert()
    input?.click()
  }

  function triggerImageUpload() {
    triggerInput(imageInput.value)
  }

  function triggerVideoUpload() {
    triggerInput(videoInput.value)
  }

  function triggerFileUpload() {
    triggerInput(fileInput.value)
  }

  function selectedFiles(input: HTMLInputElement, multiple: boolean) {
    const files = Array.from(input.files ?? [])
    return multiple ? files : files.slice(0, 1)
  }

  async function uploadFiles(files: File[], upload: (file: File) => Promise<void>) {
    for (const file of files) {
      await upload(file)
    }
  }

  async function onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const files = selectedFiles(input, options.getImageMultiple())
    input.value = ''
    if (files.length === 0) return
    if (options.isImageCropEnabled()) {
      options.openImageCrop(files)
      return
    }
    await uploadFiles(files, options.uploadImage)
  }

  async function onVideoSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const files = selectedFiles(input, options.getVideoMultiple())
    input.value = ''
    await uploadFiles(files, options.uploadVideo)
  }

  async function onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const files = selectedFiles(input, options.getFileMultiple())
    input.value = ''
    await uploadFiles(files, options.uploadFile)
  }

  return {
    imageInput,
    videoInput,
    fileInput,
    triggerImageUpload,
    triggerVideoUpload,
    triggerFileUpload,
    onImageSelected,
    onVideoSelected,
    onFileSelected,
  }
}
