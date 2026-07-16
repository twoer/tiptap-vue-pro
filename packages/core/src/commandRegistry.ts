import { DEFAULT_TOOLBAR } from './toolbar'
import type { ProEditorContext } from './types'
import type { CodeBlockLanguage } from './codeBlock'
import type { HorizontalRuleVariant } from './extensions/horizontalRule'
import type { ToolbarBuiltinKey, ToolbarConfig } from './toolbar'

export type ToolbarCommandPayload =
  | string
  | number
  | undefined

export interface CommandMeta {
  id: ToolbarBuiltinKey
  label: string
  icon?: string
  group:
    | 'history'
    | 'block'
    | 'inline'
    | 'color'
    | 'layout'
    | 'list'
    | 'insert'
    | 'utility'
  execute?: (ctx: ProEditorContext, payload?: ToolbarCommandPayload) => void
  isActive?: (ctx: ProEditorContext, payload?: ToolbarCommandPayload) => boolean
}

export const COMMAND_GROUPS: ToolbarConfig = DEFAULT_TOOLBAR

function payloadString(payload?: ToolbarCommandPayload) {
  return payload == null ? '' : String(payload)
}

function payloadNumber(payload?: ToolbarCommandPayload) {
  return Number(payload ?? 0)
}

function payloadAlign(payload?: ToolbarCommandPayload) {
  return payloadString(payload) as 'left' | 'center' | 'right' | 'justify'
}

function payloadHeadingLevel(payload?: ToolbarCommandPayload) {
  return payloadNumber(payload) as 0 | 1 | 2 | 3 | 4 | 5 | 6
}

function payloadHorizontalRuleVariant(payload?: ToolbarCommandPayload) {
  return payload == null ? undefined : payloadString(payload) as HorizontalRuleVariant
}

export const COMMAND_REGISTRY: Record<ToolbarBuiltinKey, CommandMeta> = {
  undo: { id: 'undo', label: '撤销', icon: 'Undo2', group: 'history', execute: (ctx) => ctx.commands.undo() },
  redo: { id: 'redo', label: '重做', icon: 'Redo2', group: 'history', execute: (ctx) => ctx.commands.redo() },
  heading: {
    id: 'heading',
    label: '标题',
    icon: 'Heading',
    group: 'block',
    execute: (ctx, payload) => ctx.commands.toggleHeading(payloadHeadingLevel(payload)),
    isActive: (ctx, payload) => {
      const level = payloadHeadingLevel(payload)
      return level === 0
        ? getActiveHeadingLevel(ctx) === 0
        : ctx.isActive('heading', { level })
    },
  },
  fontFamily: { id: 'fontFamily', label: '字体', icon: 'Type', group: 'inline', execute: (ctx, payload) => ctx.commands.setFontFamily(payloadString(payload)) },
  fontSize: { id: 'fontSize', label: '字号', icon: 'Baseline', group: 'inline', execute: (ctx, payload) => ctx.commands.setFontSize(payloadString(payload)) },
  lineHeight: { id: 'lineHeight', label: '行高', icon: 'Rows3', group: 'layout', execute: (ctx, payload) => ctx.commands.setLineHeight(payloadString(payload)) },
  bold: { id: 'bold', label: '加粗', icon: 'Bold', group: 'inline', execute: (ctx) => ctx.commands.bold(), isActive: (ctx) => ctx.isActive('bold') },
  italic: { id: 'italic', label: '斜体', icon: 'Italic', group: 'inline', execute: (ctx) => ctx.commands.italic(), isActive: (ctx) => ctx.isActive('italic') },
  strike: { id: 'strike', label: '删除线', icon: 'Strikethrough', group: 'inline', execute: (ctx) => ctx.commands.strike(), isActive: (ctx) => ctx.isActive('strike') },
  underline: { id: 'underline', label: '下划线', icon: 'Underline', group: 'inline', execute: (ctx) => ctx.commands.underline(), isActive: (ctx) => ctx.isActive('underline') },
  code: { id: 'code', label: '行内代码', icon: 'Code', group: 'inline', execute: (ctx) => ctx.commands.code(), isActive: (ctx) => ctx.isActive('code') },
  superscript: { id: 'superscript', label: '上标', icon: 'Superscript', group: 'inline', execute: (ctx) => ctx.commands.superscript(), isActive: (ctx) => ctx.isActive('superscript') },
  subscript: { id: 'subscript', label: '下标', icon: 'Subscript', group: 'inline', execute: (ctx) => ctx.commands.subscript(), isActive: (ctx) => ctx.isActive('subscript') },
  color: { id: 'color', label: '文字颜色', icon: 'Palette', group: 'color', execute: (ctx, payload) => ctx.commands.setColor(payloadString(payload)) },
  highlight: { id: 'highlight', label: '背景高亮', icon: 'Highlighter', group: 'color', execute: (ctx, payload) => ctx.commands.toggleHighlight(payloadString(payload)) },
  align: {
    id: 'align',
    label: '文本对齐',
    icon: 'AlignLeft',
    group: 'layout',
    execute: (ctx, payload) => ctx.commands.align(payloadAlign(payload)),
    isActive: (ctx, payload) => ctx.isActive({ textAlign: payloadAlign(payload) }),
  },
  decreaseIndent: { id: 'decreaseIndent', label: '减少缩进', icon: 'IndentDecrease', group: 'layout', execute: (ctx) => ctx.commands.decreaseIndent() },
  increaseIndent: { id: 'increaseIndent', label: '增加缩进', icon: 'IndentIncrease', group: 'layout', execute: (ctx) => ctx.commands.increaseIndent() },
  bulletList: { id: 'bulletList', label: '无序列表', icon: 'List', group: 'list', execute: (ctx) => ctx.commands.bulletList(), isActive: (ctx) => ctx.isActive('bulletList') },
  orderedList: { id: 'orderedList', label: '有序列表', icon: 'ListOrdered', group: 'list', execute: (ctx) => ctx.commands.orderedList(), isActive: (ctx) => ctx.isActive('orderedList') },
  taskList: { id: 'taskList', label: '任务列表', icon: 'ListChecks', group: 'list', execute: (ctx) => ctx.commands.taskList(), isActive: (ctx) => ctx.isActive('taskList') },
  blockquote: { id: 'blockquote', label: '引用', icon: 'Quote', group: 'block', execute: (ctx) => ctx.commands.blockquote(), isActive: (ctx) => ctx.isActive('blockquote') },
  codeBlock: {
    id: 'codeBlock',
    label: '代码块',
    icon: 'Code',
    group: 'block',
    execute: (ctx, payload) => ctx.commands.codeBlock(payload == null ? undefined : payloadString(payload) as CodeBlockLanguage),
    isActive: (ctx) => ctx.isActive('codeBlock'),
  },
  hr: { id: 'hr', label: '分割线', icon: 'Minus', group: 'insert', execute: (ctx, payload) => ctx.commands.hr(payloadHorizontalRuleVariant(payload)) },
  link: { id: 'link', label: '链接', icon: 'Link', group: 'insert' },
  image: { id: 'image', label: '图片', icon: 'ImagePlus', group: 'insert' },
  attachment: { id: 'attachment', label: '上传', icon: 'Upload', group: 'insert' },
  table: { id: 'table', label: '插入表格', icon: 'Table', group: 'insert' },
  clearFormat: { id: 'clearFormat', label: '清除格式', icon: 'Eraser', group: 'utility', execute: (ctx) => ctx.commands.clearFormat() },
  findReplace: { id: 'findReplace', label: '查找替换', icon: 'Search', group: 'utility', execute: (ctx) => ctx.commands.openFindReplace() },
  markdown: { id: 'markdown', label: '导入 / 导出 Markdown', icon: 'Markdown', group: 'utility' },
  print: { id: 'print', label: '打印', icon: 'Printer', group: 'utility' },
  fullscreen: { id: 'fullscreen', label: '全屏', icon: 'Maximize2', group: 'utility' },
  preview: { id: 'preview', label: '预览', icon: 'Eye', group: 'utility' },
}

export function getCommandMeta(id: ToolbarBuiltinKey): CommandMeta {
  return COMMAND_REGISTRY[id]
}

export function getCommandLabel(id: ToolbarBuiltinKey): string {
  return getCommandMeta(id).label
}

export function runToolbarCommand(
  ctx: ProEditorContext,
  id: ToolbarBuiltinKey,
  payload?: ToolbarCommandPayload,
): boolean {
  const execute = getCommandMeta(id).execute
  if (!execute) return false
  execute(ctx, payload)
  return true
}

export function isToolbarCommandActive(
  ctx: ProEditorContext,
  id: ToolbarBuiltinKey,
  payload?: ToolbarCommandPayload,
): boolean {
  return getCommandMeta(id).isActive?.(ctx, payload) ?? false
}

export function getActiveHeadingLevel(ctx: ProEditorContext): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    if (ctx.isActive('heading', { level })) return level
  }
  return 0
}

export function getActiveTextAlign(ctx: ProEditorContext): 'left' | 'center' | 'right' | 'justify' {
  for (const align of ['center', 'right', 'justify'] as const) {
    if (ctx.isActive({ textAlign: align })) return align
  }
  return 'left'
}
