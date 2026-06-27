export { useProEditor } from './useProEditor'
export { createDefaultExtensions } from './extensions'
export {
  handleImageFiles,
  isImageFile,
} from './handleImageUpload'

export type {
  ProEditorOptions,
  ProEditorContext,
  ProEditorCommands,
  OutputFormat,
  UploadImage,
} from './types'

// 重新导出常用 Tiptap 类型,方便 adapter 不必额外引 @tiptap/core
export type { Editor, Extension, Extensions } from '@tiptap/core'
