import { resolveLocale } from './locale'
import type { LocaleProp, LocaleTranslate } from './locale'
import type { NotifyFn } from './types'

export interface MarkdownActionContext {
  getMarkdown: () => string
  importMarkdown: (markdown: string) => void
  notify: NotifyFn
}

export interface PrintActionOptions {
  title?: string
  cleanupDelay?: number
  locale?: LocaleProp
  t?: LocaleTranslate
}

export interface ExportMarkdownOptions {
  filename?: string | (() => string)
  locale?: LocaleProp
  t?: LocaleTranslate
}

const DEFAULT_PRINT_CLEANUP_DELAY = 500
// onload 因浏览器策略不触发时的兜底回收时限,需大于正常路径(加载 + 打印对话框 + cleanupDelay)
const PRINT_FALLBACK_CLEANUP_MS = 10_000
const PRINT_STYLES = 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;padding:24px;line-height:1.6}img{max-width:100%}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 10px}pre{background:#f5f7fa;padding:12px;border-radius:4px;overflow-x:auto}code{background:#f5f7fa;padding:1px 4px;border-radius:3px}blockquote{border-left:3px solid #ddd;padding-left:1em;color:#666}'

function resolveExportMarkdownFilename(filename: ExportMarkdownOptions['filename']): string {
  const resolved = typeof filename === 'function' ? filename() : filename
  const trimmed = resolved?.trim()
  return trimmed || `content-${Date.now()}.md`
}

export async function importMarkdownFile(
  ctx: Pick<MarkdownActionContext, 'importMarkdown' | 'notify'>,
  file: File,
  options: { locale?: LocaleProp; t?: LocaleTranslate } = {},
) {
  const { t: fallbackT } = resolveLocale(options.locale)
  const t = options.t ?? fallbackT
  try {
    const text = await file.text()
    ctx.importMarkdown(text)
    ctx.notify(t('notify.markdownImportSuccess'), 'success')
  } catch {
    ctx.notify(t('notify.markdownImportReadFailed'), 'error')
  }
}

export function exportMarkdownFile(
  ctx: Pick<MarkdownActionContext, 'getMarkdown' | 'notify'>,
  options: ExportMarkdownOptions = {},
): boolean {
  const { t: fallbackT } = resolveLocale(options.locale)
  const t = options.t ?? fallbackT
  const md = ctx.getMarkdown()
  if (!md) {
    ctx.notify(t('notify.markdownExportUnavailable'), 'warning')
    return false
  }
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = resolveExportMarkdownFilename(options.filename)
  a.click()
  URL.revokeObjectURL(url)
  return true
}

export function printEditorContent(
  html: string,
  options: PrintActionOptions = {},
): HTMLIFrameElement {
  const { t: fallbackT } = resolveLocale(options.locale)
  const t = options.t ?? fallbackT
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  // srcdoc 异步加载,替代已废弃的 document.write;清理幂等:
  // 正常路径在打印后按 cleanupDelay 回收,onload 不触发时由兜底超时回收。
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    iframe.remove()
  }
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      setTimeout(cleanup, options.cleanupDelay ?? DEFAULT_PRINT_CLEANUP_DELAY)
    }
  }
  iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${options.title ?? t('print.defaultTitle')}</title>
<style>${PRINT_STYLES}</style>
</head><body>${html}</body></html>`
  setTimeout(cleanup, PRINT_FALLBACK_CLEANUP_MS)

  return iframe
}
