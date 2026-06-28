export { useProEditor } from './useProEditor'
export { createDefaultExtensions } from './extensions'
export {
  CODE_BLOCK_LANGUAGES,
  codeBlockLanguageLabel,
} from './codeBlock'
export type { CodeBlockLanguage } from './codeBlock'
export { ImageExtended } from './extensions/image'
export type { ImageAlign, ImageSizePreset } from './extensions/image'
export {
  handleImageFiles,
  hasImageFiles,
  isImageFile,
} from './handleImageUpload'
export type { ImageUploadErrorFn } from './handleImageUpload'
export {
  MarkdownExtension,
  getMarkdown,
  importMarkdown,
} from './markdown'

export type {
  ProEditorOptions,
  ProEditorContext,
  ProEditorCommands,
  OutputFormat,
  UploadImage,
  NotifyType,
  NotifyFn,
} from './types'

// 重新导出常用 Tiptap 类型,方便 adapter 不必额外引 @tiptap/core
// Editor 从 vue-3 导出(实际使用的就是 vue-3 的 Editor,与 useEditor 一致)
export type { Editor } from '@tiptap/vue-3'
export type { Extension, Extensions } from '@tiptap/core'
