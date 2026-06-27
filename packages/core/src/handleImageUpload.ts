import type { Editor } from '@tiptap/core'
import type { UploadImage } from './types'

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
 * - 上传失败的单张图片静默跳过,不阻塞其余图片。
 *   adapter 若需要提示,可在外层包一层并自行处理。
 */
export async function handleImageFiles(
  files: File[] | FileList | null | undefined,
  upload: UploadImage | undefined,
  editor: Editor,
): Promise<boolean> {
  if (!files || files.length === 0) return false
  if (!upload) return false

  const images = Array.from(files).filter(isImageFile)
  if (images.length === 0) return false

  // 串行上传,保证插入顺序与拖入顺序一致
  for (const file of images) {
    try {
      const url = await upload(file)
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
    } catch {
      // 单张失败不中断其余
    }
  }
  return true
}
