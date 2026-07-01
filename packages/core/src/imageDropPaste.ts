import type { ProEditorContext, UploadImage } from './types'
import type { EditorBehaviorOptions } from './editorBehaviorOptions'
import { resolveEditorBehaviorOptions } from './editorBehaviorOptions'
import {
  handleImageFiles,
  hasImageFiles,
  isImageFileValidationFailure,
  notifyImageFileValidationFailure,
} from './handleImageUpload'

/**
 * Shared paste/drop image handling for UI adapters.
 *
 * The sync hasImageFiles check decides whether the browser default should be
 * prevented. Uploading remains async, but the event decision stays synchronous.
 */
export function useImageDropPaste(
  ctx: ProEditorContext,
  getUploadImage: () => UploadImage | undefined,
  getEditorBehaviorOptions?: () => EditorBehaviorOptions | undefined,
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
    const imageOptions = resolveEditorBehaviorOptions(getEditorBehaviorOptions?.()).image
    void handleImageFiles(files, uploadImage, ed, (_file, error) => {
      if (isImageFileValidationFailure(error)) {
        notifyImageFileValidationFailure(ctx, error)
        return
      }
      ctx.notify(ctx.t('notify.partialImageUploadFailed'), 'error')
    }, imageOptions)
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
