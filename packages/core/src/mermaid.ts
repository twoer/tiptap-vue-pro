import type { LocaleCode } from './locale'

export const MERMAID_VIEW_MODES = ['code', 'diagram', 'split'] as const

export type MermaidViewMode = (typeof MERMAID_VIEW_MODES)[number]
export type MermaidTheme = 'light' | 'dark'

export interface MermaidBlockAttributes {
  viewMode: MermaidViewMode
}

export function normalizeMermaidViewMode(value: unknown): MermaidViewMode {
  return MERMAID_VIEW_MODES.includes(value as MermaidViewMode)
    ? value as MermaidViewMode
    : 'split'
}

export function getDefaultMermaidSource(locale: LocaleCode = 'zh-CN'): string {
  const labels = locale === 'en-US'
    ? { start: 'Start', end: 'End' }
    : { start: '开始', end: '结束' }

  return `flowchart TD\n  A[${labels.start}] --> B[${labels.end}]`
}

export function mermaidMarkdownFence(source: string): string {
  const longestRun = Math.max(0, ...Array.from(source.matchAll(/`+/g), match => match[0].length))
  const fence = '`'.repeat(Math.max(3, longestRun + 1))
  return `${fence}mermaid\n${source}\n${fence}`
}
