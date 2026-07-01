export { useProEditor } from './useProEditor'
export {
  createDebugLogger,
  isDebugEnabledFor,
  resolveDebugOptions,
  sanitizeDebugPayload,
} from './debug'
export type {
  ProEditorDebugChannel,
  ProEditorDebugEntry,
  ProEditorDebugLevel,
  ProEditorDebugLogger,
  ProEditorDebugLogFn,
  ProEditorDebugOptions,
  ProEditorDebugSource,
} from './debug'
export {
  DEFAULT_LOCALE,
  EN_US_LOCALE_MESSAGES,
  ZH_CN_LOCALE_MESSAGES,
  resolveLocale,
} from './locale'
export type {
  LocaleCode,
  LocaleKey,
  LocaleMessageOverrides,
  LocaleMessages,
  LocaleOptions,
  LocaleProp,
  LocaleTranslate,
  ResolvedLocale,
} from './locale'
export { createDefaultExtensions } from './extensions'
export {
  createEditorExtensions,
  DEFAULT_EXTENSION_CONFIG,
} from './extensionRegistry'
export type { EditorExtensionConfig } from './extensionRegistry'
export {
  CODE_BLOCK_LANGUAGES,
  codeBlockLanguageLabel,
} from './codeBlock'
export type { CodeBlockLanguage } from './codeBlock'
export {
  DEFAULT_EDITOR_BEHAVIOR_OPTIONS,
  resolveEditorBehaviorOptions,
} from './editorBehaviorOptions'
export type {
  EditorAssetBehaviorOptions,
  EditorBehaviorOptions,
  EditorAudioRenderOptions,
  EditorImageBehaviorOptions,
  EditorMediaAssetMetadata,
  EditorMediaBehaviorOptions,
  EditorFileRenderOptions,
  EditorVideoRenderOptions,
  FileAttachmentIconMode,
  ResolvedEditorAssetBehaviorOptions,
  EditorLinkBehaviorOptions,
  EditorLinkTarget,
  ResolvedEditorAudioRenderOptions,
  ResolvedEditorImageBehaviorOptions,
  ResolvedEditorFileRenderOptions,
  ResolvedEditorMediaBehaviorOptions,
  ResolvedEditorVideoRenderOptions,
  EditorTableBehaviorOptions,
  ResolvedEditorBehaviorOptions,
} from './editorBehaviorOptions'
export { ImageExtended } from './extensions/image'
export type { ImageAlign, ImageSizePreset } from './extensions/image'
export {
  HORIZONTAL_RULE_VARIANTS,
  HorizontalRuleExtended,
  insertHorizontalRule,
  normalizeHorizontalRuleVariant,
} from './extensions/horizontalRule'
export type { HorizontalRuleAttributes, HorizontalRuleVariant } from './extensions/horizontalRule'
export { AudioExtended, FileAttachment, VideoExtended } from './extensions/media'
export {
  normalizeUploadedAsset,
  notifyAssetFileValidationFailure,
  notifyAssetUploadFailure,
  validateAssetFile,
} from './handleAssetUpload'
export type { AssetFileValidationFailure } from './handleAssetUpload'
export {
  formatFileSize,
  handleImageFiles,
  hasImageFiles,
  isImageFileValidationFailure,
  isImageFile,
  notifyImageFileValidationFailure,
  validateImageFile,
} from './handleImageUpload'
export type { ImageFileValidationFailure, ImageUploadErrorFn } from './handleImageUpload'
export { getActiveLinkRange } from './linkRange'
export type { ActiveLinkRange } from './linkRange'
export { getSelectedFileAttachment } from './fileAttachmentSelection'
export type { ActiveFileAttachment } from './fileAttachmentSelection'
export {
  fileAttachmentToMediaNodeAttrs,
  getSelectedMediaNode,
  mediaNodeToFileAttachmentAttrs,
} from './mediaSelection'
export type { ActiveMediaNode, SelectedMediaKind } from './mediaSelection'
export { getSelectedHorizontalRule } from './horizontalRuleSelection'
export type { ActiveHorizontalRule } from './horizontalRuleSelection'
export { useEditorEventBridge } from './editorEventBridge'
export { useEditorPluginRegistration } from './editorPluginRegistration'
export type { EditorPluginRegistrationOptions } from './editorPluginRegistration'
export { useImageDropPaste } from './imageDropPaste'
export {
  MarkdownExtension,
  createMarkdownManager,
  getNativeMarkdownManager,
  getMarkdown,
  importMarkdown,
} from './markdown'
export type { ProMarkdownManager } from './markdown'
export {
  DEFAULT_TOOLBAR,
  normalizeToolbarConfig,
} from './toolbar'
export {
  TOOLBAR_ALIGN_OPTIONS,
  TOOLBAR_CODE_BLOCK_LANGUAGES,
  TOOLBAR_FONT_FAMILIES,
  TOOLBAR_FONT_SIZES,
  TOOLBAR_HEADING_OPTIONS,
  TOOLBAR_HEADING_PREVIEW_STYLES,
  TOOLBAR_HORIZONTAL_RULE_OPTIONS,
  TOOLBAR_LINE_HEIGHTS,
  TOOLBAR_MARKDOWN_IMPORT_ACCEPT,
  TOOLBAR_MARKDOWN_OPTIONS,
  TOOLBAR_PRESET_COLORS,
  TOOLBAR_PRESET_HIGHLIGHTS,
  TOOLBAR_TABLE_GRID,
  resolveToolbarOptions,
} from './toolbarConfigData'
export type {
  ResolvedToolbarOptions,
  ResolvedToolbarMarkdownOptions,
  ResolvedToolbarTableGridOptions,
  ToolbarAlignOption,
  ToolbarCodeBlockLanguageOption,
  ToolbarFontFamilyOption,
  ToolbarHorizontalRuleOption,
  ToolbarHeadingLevel,
  ToolbarHeadingOption,
  ToolbarMarkdownAction,
  ToolbarMarkdownOption,
  ToolbarMarkdownOptions,
  ToolbarOptions,
  ToolbarPrintOptions,
  ToolbarTableGridOptions,
  ToolbarTextAlign,
} from './toolbarConfigData'
export {
  exportMarkdownFile,
  importMarkdownFile,
  printEditorContent,
} from './toolbarActions'
export type { ExportMarkdownOptions, MarkdownActionContext, PrintActionOptions } from './toolbarActions'
export {
  COMMAND_GROUPS,
  COMMAND_REGISTRY,
  getActiveHeadingLevel,
  getActiveTextAlign,
  getCommandLabel,
  getCommandMeta,
  isToolbarCommandActive,
  runToolbarCommand,
} from './commandRegistry'
export type { CommandMeta, ToolbarCommandPayload } from './commandRegistry'
export type {
  ToolbarBuiltinKey,
  ToolbarConfig,
  ToolbarGroupConfig,
  ToolbarProp,
} from './toolbar'

export type {
  ProEditorOptions,
  ProEditorContext,
  ProEditorCommands,
  OutputFormat,
  UploadedAsset,
  UploadAsset,
  UploadAssetKind,
  UploadImage,
  NotifyType,
  NotifyFn,
} from './types'

// 重新导出常用 Tiptap 类型,方便 adapter 不必额外引 @tiptap/core
// Editor 从 vue-3 导出(实际使用的就是 vue-3 的 Editor,与 useEditor 一致)
export type { Editor } from '@tiptap/vue-3'
export type { Extension, Extensions } from '@tiptap/core'
