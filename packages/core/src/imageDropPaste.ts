import type { ProEditorContext, UploadImage } from './types'
import { handleImageFiles, hasImageFiles } from './handleImageUpload'

/**
 * Shared paste/drop image handling for UI adapters.
 *
 * The sync hasImageFiles check decides whether the browser default should be
 * prevented. Uploading remains async, but the event decision stays synchronous.
 */
export function useImageDropPaste(
  ctx: ProEditorContext,
  getUploadImage: () => UploadImage | undefined,
) {
  function consumeFiles(
    files: File[] | FileList | null | undefined,
    preventDefault: () => void,
  ) {
    const uploadImage = getUploadImage()
    if (!uploadImage) return
    if (!hasImageFiles(files)) return
    const ed = ctx.editor.value
    if (!ed) return
    preventDefault()
    void handleImageFiles(files, uploadImage, ed, () => {
      ctx.notify('部分图片上传失败', 'error')
    })
  }

  function onPaste(e: ClipboardEvent) {
    consumeFiles(e.clipboardData?.files, () => e.preventDefault())
  }

  function onDrop(e: DragEvent) {
    consumeFiles(e.dataTransfer?.files, () => e.preventDefault())
  }

  return {
    onPaste,
    onDrop,
  }
}
