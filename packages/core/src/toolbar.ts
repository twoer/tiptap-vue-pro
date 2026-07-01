export type ToolbarBuiltinKey =
  | 'undo'
  | 'redo'
  | 'heading'
  | 'fontFamily'
  | 'fontSize'
  | 'lineHeight'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'underline'
  | 'code'
  | 'superscript'
  | 'subscript'
  | 'color'
  | 'highlight'
  | 'align'
  | 'decreaseIndent'
  | 'increaseIndent'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'hr'
  | 'link'
  | 'image'
  | 'attachment'
  | 'table'
  | 'clearFormat'
  | 'markdown'
  | 'print'
  | 'fullscreen'
  | 'preview'

export type ToolbarGroupConfig = ToolbarBuiltinKey[]
export type ToolbarConfig = ToolbarGroupConfig[]
export type ToolbarProp = ToolbarConfig | false

export const DEFAULT_TOOLBAR: ToolbarConfig = [
  ['undo', 'redo'],
  ['heading', 'fontFamily', 'fontSize', 'lineHeight'],
  ['bold', 'italic', 'underline', 'strike', 'code', 'superscript', 'subscript'],
  ['color', 'highlight', 'clearFormat'],
  ['align', 'decreaseIndent', 'increaseIndent'],
  ['bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock'],
  ['link', 'image', 'attachment', 'table', 'hr'],
  ['markdown', 'print'],
  ['preview', 'fullscreen'],
]

export function normalizeToolbarConfig(toolbar?: ToolbarProp): ToolbarConfig {
  if (toolbar === false) return []
  const source = toolbar ?? DEFAULT_TOOLBAR
  return source
    .filter((group) => group.length > 0)
    .map((group) => [...group])
}
