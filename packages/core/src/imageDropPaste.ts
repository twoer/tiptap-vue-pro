import type { ProEditorContext, UploadImage } from './types'
import type { ProEditorDebugLogFn } from './debug'
import type { EditorBehaviorOptions } from './editorBehaviorOptions'
import { resolveEditorBehaviorOptions } from './editorBehaviorOptions'
import {
  handleImageFiles,
  hasImageFiles,
  isImageFile,
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
  debugLog?: ProEditorDebugLogFn,
) {
  function consumeFiles(
    files: File[] | FileList | null | undefined,
    preventDefault: () => void,
    source: 'paste' | 'drop',
  ) {
    const uploadImage = getUploadImage()
    if (!uploadImage) return
    if (!hasImageFiles(files)) return
    const ed = ctx.editor.value
    if (!ed) return
    preventDefault()
    const imageOptions = resolveEditorBehaviorOptions(getEditorBehaviorOptions?.()).image
    const imageFileCount = Array.from(files ?? []).filter(isImageFile).length
    debugLog?.('upload', `image-${source}:start`, { fileCount: imageFileCount })
    void handleImageFiles(files, uploadImage, ed, (file, error) => {
      if (isImageFileValidationFailure(error)) {
        debugLog?.(
          'upload',
          `image-${source}:validation-error`,
          { fileName: file.name, reason: error.reason },
          'warn',
        )
        notifyImageFileValidationFailure(ctx, error)
        return
      }
      debugLog?.(
        'upload',
        `image-${source}:error`,
        { fileName: file.name },
        'error',
        error,
      )
      ctx.notify(ctx.t('notify.partialImageUploadFailed'), 'error')
    }, imageOptions).then((consumed) => {
      debugLog?.('upload', `image-${source}:complete`, { consumed, fileCount: imageFileCount }, 'info')
    }).catch((error) => {
      debugLog?.('upload', `image-${source}:error`, { fileCount: imageFileCount }, 'error', error)
      ctx.notify(ctx.t('notify.partialImageUploadFailed'), 'error')
    })
  }

  function onPaste(e: ClipboardEvent) {
    consumeFiles(e.clipboardData?.files, () => e.preventDefault(), 'paste')
  }

  function onDrop(e: DragEvent) {
    consumeFiles(e.dataTransfer?.files, () => e.preventDefault(), 'drop')
  }

  return {
    onPaste,
    onDrop,
  }
}
