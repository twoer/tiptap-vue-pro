import type { Extensions } from '@tiptap/core'
import { createDefaultExtensions } from './extensions'

export interface EditorExtensionConfig {
  placeholder?: boolean
  placeholderText?: string
  starterKit?: boolean
  characterCount?: boolean
  image?: boolean
  table?: boolean
  typography?: boolean
  highlight?: boolean
  textAlign?: boolean
  blockIndent?: boolean
  codeBlock?: boolean
  script?: boolean
  taskList?: boolean
  media?: boolean
  rangeSelection?: boolean
  markdown?: boolean
}

export const DEFAULT_EXTENSION_CONFIG: Required<
  Omit<EditorExtensionConfig, 'placeholderText'>
> = {
  placeholder: true,
  starterKit: true,
  characterCount: true,
  image: true,
  table: true,
  typography: true,
  highlight: true,
  textAlign: true,
  blockIndent: true,
  codeBlock: true,
  script: true,
  taskList: true,
  media: true,
  rangeSelection: true,
  markdown: true,
}

export function createEditorExtensions(
  config: EditorExtensionConfig = {},
): Extensions {
  return createDefaultExtensions(config.placeholderText, config)
}
