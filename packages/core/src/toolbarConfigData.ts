import { CODE_BLOCK_LANGUAGES } from './codeBlock'

export type ToolbarHeadingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type ToolbarTextAlign = 'left' | 'center' | 'right' | 'justify'
export type ToolbarMarkdownAction = 'import' | 'export'

export interface ToolbarHeadingOption {
  label: string
  level: ToolbarHeadingLevel
}

export interface ToolbarFontFamilyOption {
  label: string
  value: string
}

export interface ToolbarCodeBlockLanguageOption {
  label: string
  value: string
}

export interface ToolbarAlignOption {
  label: string
  value: ToolbarTextAlign
}

export interface ToolbarMarkdownOption {
  label: string
  value: ToolbarMarkdownAction
}

export interface ToolbarTableGridOptions {
  maxRows?: number
  maxCols?: number
}

export interface ResolvedToolbarTableGridOptions {
  maxRows: number
  maxCols: number
}

export interface ToolbarMarkdownOptions {
  importAccept?: string
  exportFilename?: string | (() => string)
}

export interface ResolvedToolbarMarkdownOptions {
  importAccept: string
  exportFilename?: string | (() => string)
}

export interface ToolbarPrintOptions {
  title?: string
  cleanupDelay?: number
}

export interface ToolbarOptions {
  fontFamilies?: ToolbarFontFamilyOption[]
  fontSizes?: string[]
  lineHeights?: string[]
  colors?: string[]
  highlights?: string[]
  codeBlockLanguages?: ToolbarCodeBlockLanguageOption[]
  tableGrid?: ToolbarTableGridOptions
  markdown?: ToolbarMarkdownOptions
  print?: ToolbarPrintOptions
}

export interface ResolvedToolbarOptions {
  fontFamilies: ToolbarFontFamilyOption[]
  fontSizes: string[]
  lineHeights: string[]
  colors: string[]
  highlights: string[]
  codeBlockLanguages: ToolbarCodeBlockLanguageOption[]
  tableGrid: ResolvedToolbarTableGridOptions
  markdown: ResolvedToolbarMarkdownOptions
  print: ToolbarPrintOptions
}

export const TOOLBAR_HEADING_OPTIONS: ToolbarHeadingOption[] = [
  { label: '正文', level: 0 },
  { label: '标题 1', level: 1 },
  { label: '标题 2', level: 2 },
  { label: '标题 3', level: 3 },
  { label: '标题 4', level: 4 },
  { label: '标题 5', level: 5 },
  { label: '标题 6', level: 6 },
]

export const TOOLBAR_HEADING_PREVIEW_STYLES: Record<ToolbarHeadingLevel, { fontSize: string; fontWeight: number }> = {
  0: { fontSize: '13px', fontWeight: 400 },
  1: { fontSize: '15px', fontWeight: 700 },
  2: { fontSize: '14px', fontWeight: 700 },
  3: { fontSize: '13px', fontWeight: 600 },
  4: { fontSize: '13px', fontWeight: 600 },
  5: { fontSize: '12px', fontWeight: 600 },
  6: { fontSize: '12px', fontWeight: 500 },
}

export const TOOLBAR_PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
  '#e03131', '#e8590c', '#f08c00', '#fcc419',
  '#d9480f', '#f76707', '#fa5252', '#ff6b6b',
  '#2f9e44', '#40c057', '#82c91e', '#a9e34b',
  '#0c8599', '#1098ad', '#15aabf', '#22b8cf',
  '#1864ab', '#1971c2', '#228be6', '#4dabf7',
  '#5f3dc4', '#6741d9', '#7048e8', '#9775fa',
  '#a61e4d', '#c2255c', '#d6336c', '#f06595',
  '#5c2f14', '#7b4019', '#a0522d', '#c08456',
]

export const TOOLBAR_PRESET_HIGHLIGHTS = [
  '#fff3bf', '#ffe8cc', '#ffe066', '#fab005',
  '#ffc9c9', '#ffa8a8', '#ff8787', '#fa5252',
  '#d3f9d8', '#b2f2bb', '#8ce99a', '#40c057',
  '#c3fae8', '#96f2d7', '#63e6be', '#0ca678',
  '#d0ebff', '#a5d8ff', '#74c0fc', '#1c7ed6',
  '#e5dbff', '#d0bfff', '#b197fc', '#7048e8',
  '#fcc2d7', '#faa2c1', '#f783ac', '#d6336c',
  '#fff0f6', '#ffdeeb', '#fcc2d7', '#e64980',
]

export const TOOLBAR_FONT_FAMILIES: ToolbarFontFamilyOption[] = [
  { label: '默认字体', value: '' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Times New Roman', value: '"Times New Roman"' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Monospace', value: 'monospace' },
]

export const TOOLBAR_FONT_SIZES = ['', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px', '64px', '72px', '96px']
export const TOOLBAR_LINE_HEIGHTS = ['', '1', '1.2', '1.4', '1.6', '1.8', '2']
export const TOOLBAR_CODE_BLOCK_LANGUAGES: ToolbarCodeBlockLanguageOption[] = CODE_BLOCK_LANGUAGES.map((language) => ({ ...language }))
export const TOOLBAR_TABLE_GRID: ResolvedToolbarTableGridOptions = {
  maxRows: 8,
  maxCols: 10,
}
export const TOOLBAR_MARKDOWN_IMPORT_ACCEPT = '.md,.markdown,text/markdown,text/plain'

export const TOOLBAR_ALIGN_OPTIONS: ToolbarAlignOption[] = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' },
  { label: '两端对齐', value: 'justify' },
]

export const TOOLBAR_MARKDOWN_OPTIONS: ToolbarMarkdownOption[] = [
  { label: '导入', value: 'import' },
  { label: '导出', value: 'export' },
]

function resolvePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const normalized = Math.floor(value)
  return normalized > 0 ? normalized : fallback
}

export function resolveToolbarOptions(options: ToolbarOptions = {}): ResolvedToolbarOptions {
  return {
    fontFamilies: [...(options.fontFamilies ?? TOOLBAR_FONT_FAMILIES)],
    fontSizes: [...(options.fontSizes ?? TOOLBAR_FONT_SIZES)],
    lineHeights: [...(options.lineHeights ?? TOOLBAR_LINE_HEIGHTS)],
    colors: [...(options.colors ?? TOOLBAR_PRESET_COLORS)],
    highlights: [...(options.highlights ?? TOOLBAR_PRESET_HIGHLIGHTS)],
    codeBlockLanguages: [...(options.codeBlockLanguages ?? TOOLBAR_CODE_BLOCK_LANGUAGES)],
    tableGrid: {
      maxRows: resolvePositiveInteger(options.tableGrid?.maxRows, TOOLBAR_TABLE_GRID.maxRows),
      maxCols: resolvePositiveInteger(options.tableGrid?.maxCols, TOOLBAR_TABLE_GRID.maxCols),
    },
    markdown: {
      importAccept: options.markdown?.importAccept ?? TOOLBAR_MARKDOWN_IMPORT_ACCEPT,
      exportFilename: options.markdown?.exportFilename,
    },
    print: { ...(options.print ?? {}) },
  }
}
