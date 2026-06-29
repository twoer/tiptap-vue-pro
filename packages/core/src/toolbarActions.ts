import type { NotifyFn } from './types'

export interface MarkdownActionContext {
  getMarkdown: () => string
  importMarkdown: (markdown: string) => void
  notify: NotifyFn
}

export interface PrintActionOptions {
  title?: string
  cleanupDelay?: number
}

export interface ExportMarkdownOptions {
  filename?: string | (() => string)
}

const DEFAULT_PRINT_TITLE = '打印'
const DEFAULT_PRINT_CLEANUP_DELAY = 500
const PRINT_STYLES = 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;padding:24px;line-height:1.6}img{max-width:100%}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 10px}pre{background:#f5f7fa;padding:12px;border-radius:4px;overflow-x:auto}code{background:#f5f7fa;padding:1px 4px;border-radius:3px}blockquote{border-left:3px solid #ddd;padding-left:1em;color:#666}'

function resolveExportMarkdownFilename(filename: ExportMarkdownOptions['filename']): string {
  const resolved = typeof filename === 'function' ? filename() : filename
  const trimmed = resolved?.trim()
  return trimmed || `content-${Date.now()}.md`
}

export async function importMarkdownFile(
  ctx: Pick<MarkdownActionContext, 'importMarkdown' | 'notify'>,
  file: File,
) {
  try {
    const text = await file.text()
    ctx.importMarkdown(text)
    ctx.notify('已导入 Markdown', 'success')
  } catch {
    ctx.notify('导入失败:无法读取该文件', 'error')
  }
}

export function exportMarkdownFile(
  ctx: Pick<MarkdownActionContext, 'getMarkdown' | 'notify'>,
  options: ExportMarkdownOptions = {},
): boolean {
  const md = ctx.getMarkdown()
  if (!md) {
    ctx.notify('当前未启用 Markdown 能力,无法导出', 'warning')
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
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    throw new Error('Unable to access print iframe document')
  }

  doc.open()
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${options.title ?? DEFAULT_PRINT_TITLE}</title>
<style>${PRINT_STYLES}</style>
</head><body>${html}</body></html>`)
  doc.close()

  const cleanup = () => iframe.remove()
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(cleanup, options.cleanupDelay ?? DEFAULT_PRINT_CLEANUP_DELAY)
  }

  return iframe
}
