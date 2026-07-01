import type { Editor } from '@tiptap/core'
import type { EditorImageBehaviorOptions } from './editorBehaviorOptions'
import type { ProEditorContext, UploadImage } from './types'

export type ImageFileValidationFailure =
  | {
    reason: 'invalid-type'
    file: File
  }
  | {
    reason: 'too-large'
    file: File
    size: number
    maxSize: number
  }

/**
 * 判断是否为图片文件(基于 MIME 类型,不依赖文件名扩展)。
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * 同步判断文件列表中是否含图片文件。
 *
 * 用途:paste/drop 事件处理器需要在**同步阶段**决定是否 preventDefault,
 * 否则浏览器会在异步上传完成前执行默认行为(如把图片当链接打开)。
 * handleImageFiles 是 async 不能用于这个判断,故抽出此同步谓词。
 */
export function hasImageFiles(
  files: File[] | FileList | null | undefined,
): boolean {
  if (!files || files.length === 0) return false
  return Array.from(files).some(isImageFile)
}

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

export function validateImageFile(
  file: File,
  options: EditorImageBehaviorOptions = {},
): ImageFileValidationFailure | null {
  if (!isImageFile(file)) {
    return { reason: 'invalid-type', file }
  }
  const maxSize = options.maxSize
  if (typeof maxSize === 'number' && maxSize > 0 && file.size > maxSize) {
    return {
      reason: 'too-large',
      file,
      size: file.size,
      maxSize,
    }
  }
  return null
}

export function isImageFileValidationFailure(
  value: unknown,
): value is ImageFileValidationFailure {
  return typeof value === 'object'
    && value !== null
    && 'reason' in value
    && ((value as { reason?: unknown }).reason === 'invalid-type'
      || (value as { reason?: unknown }).reason === 'too-large')
}

export function notifyImageFileValidationFailure(
  ctx: Pick<ProEditorContext, 'notify' | 't'>,
  failure: ImageFileValidationFailure,
) {
  if (failure.reason === 'too-large') {
    ctx.notify(
      ctx.t('notify.imageFileTooLarge', {
        size: formatFileSize(failure.size),
        limit: formatFileSize(failure.maxSize),
      }),
      'warning',
    )
    return
  }
  ctx.notify(ctx.t('notify.invalidImageFile'), 'warning')
}

/**
 * 单张图片上传失败的回调契约。
 *
 * 粘贴/拖拽批量上传时,handleImageFiles 默认对单张失败静默跳过(不中断其余)。
 * adapter 若希望给用户提示,传入此回调;Core 决定「哪张失败了」,adapter 决定
 * 「用什么 UI 显示」(与 NotifyFn 的职责划分一致)。
 */
export type ImageUploadErrorFn = (file: File, error: unknown) => void

/**
 * 批量处理粘贴/拖拽进来的图片:
 * - 过滤出图片文件
 * - 逐个调用 uploadImage 拿到 url
 * - 调用 commands 插入文档
 *
 * 返回 true 表示"已消费这些文件"(阻止浏览器默认行为,如打开图片)。
 *
 * 设计说明:
 * - 这里只做"图片上传",非图片文件(如 pdf/doc)交还给浏览器默认行为,
 *   符合 MVP 范围(文件附件是第二阶段)。
 * - 上传失败的单张图片跳过,不阻塞其余图片。
 *   onError 可选:传入则在单张失败时回调(供 adapter 提示用户),不传则静默。
 *   之前的版本是纯静默(空 catch),粘贴/拖拽失败时用户无感知——这是已知短板,
 *   现通过 onError 暴露给调用方,保持向后兼容(第 4 参可选)。
 */
export async function handleImageFiles(
  files: File[] | FileList | null | undefined,
  upload: UploadImage | undefined,
  editor: Editor,
  onError?: ImageUploadErrorFn,
  imageOptions?: EditorImageBehaviorOptions,
): Promise<boolean> {
  if (!files || files.length === 0) return false
  if (!upload) return false

  const images = Array.from(files).filter(isImageFile)
  if (images.length === 0) return false

  // 串行上传,保证插入顺序与拖入顺序一致
  for (const file of images) {
    const validationFailure = validateImageFile(file, imageOptions)
    if (validationFailure) {
      onError?.(file, validationFailure)
      continue
    }
    try {
      const url = await upload(file)
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      } else if (onError) {
        // upload 返回 null 也视为失败(约定见 UploadImage)
        onError(file, new Error('upload returned null'))
      }
    } catch (err) {
      // 单张失败不中断其余;有回调则通知调用方
      onError?.(file, err)
    }
  }
  return true
}
