import { resolveLocale } from './locale'
import type { LocaleProp, LocaleTranslate } from './locale'
import { renderMermaidSvg } from './mermaidRenderer'
import { renderMathToString } from './mathRenderer'
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

export interface InlineMermaidSvgOptions {
  /** 注入自定义渲染函数(测试用);默认走 mermaidRenderer 的亮色主题 */
  render?: (source: string) => Promise<string>
}

export interface InlineMathPrintHtmlOptions {
  /** 注入自定义渲染函数(测试用);默认走 renderMathToString 的 MathML 输出 */
  render?: (latex: string, displayMode: boolean) => Promise<string>
}

const DEFAULT_PRINT_CLEANUP_DELAY = 500
// onload 因浏览器策略不触发时的兜底回收时限,需大于正常路径(加载 + 打印对话框 + cleanupDelay)
const PRINT_FALLBACK_CLEANUP_MS = 10_000
// @page 承担纸张与页边距,body 不再加 padding,避免双重留白;
// print-color-adjust 让代码块背景、高亮等背景色在「另存为 PDF」中保留;
// break-* 规则控制分页:标题不与后文断开,表格行 / 代码块 / 引用 / 图形整体换页。
const PRINT_STYLES = [
  '@page{size:A4;margin:18mm 16mm}',
  'html,body{background:#fff}',
  'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#1f2937;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
  'h1,h2,h3,h4,h5,h6{break-after:avoid;page-break-after:avoid}',
  'img,svg{max-width:100%;height:auto}',
  'table{border-collapse:collapse;width:100%}',
  'th,td{border:1px solid #ddd;padding:6px 10px}',
  'tr{break-inside:avoid;page-break-inside:avoid}',
  'pre{background:#f5f7fa;padding:12px;border-radius:4px;white-space:pre-wrap;word-break:break-word;break-inside:avoid;page-break-inside:avoid}',
  'code{background:#f5f7fa;padding:1px 4px;border-radius:3px}',
  'blockquote{border-left:3px solid #ddd;padding-left:1em;color:#666;break-inside:avoid;page-break-inside:avoid}',
  'ul[data-type="taskList"]{list-style:none;padding-left:4px}',
  'ul[data-type="taskList"] li{display:flex;align-items:flex-start;gap:6px}',
  'ul[data-type="taskList"] li>label{flex:0 0 auto;margin-top:0.25em}',
  'ul[data-type="taskList"] li>div{flex:1 1 auto;min-width:0}',
  '.tvp-print-mermaid{margin:1em 0;text-align:center;break-inside:avoid;page-break-inside:avoid}',
  // 公式打印走 MathML(自包含),块级居中、整块不跨页
  '[data-type="math-block"]{margin:1em 0;text-align:center;break-inside:avoid;page-break-inside:avoid}',
  '[data-type="math-block"] .katex-display{margin:0}',
].join('')

const MERMAID_BLOCK_SELECTOR = '[data-type="mermaid-block"]'
const MATH_NODE_SELECTOR = '[data-type="math-inline"], [data-type="math-block"]'

/**
 * 把 HTML 里的 Mermaid 块替换为渲染后的 SVG,供打印 / 导出 PDF 使用。
 * getHTML() 对 Mermaid 只输出源码 pre,直接打印会丢失图形;
 * 渲染失败的块保留源码 pre,不阻塞导出流程。
 */
export async function inlineMermaidSvg(
  html: string,
  options: InlineMermaidSvgOptions = {},
): Promise<string> {
  // 快速路径:绝大多数文档没有 Mermaid 块,避免无谓的 DOMParser 解析
  if (!html.includes('data-type="mermaid-block"')) return html
  const render = options.render ?? ((source: string) => renderMermaidSvg(source, 'light'))
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks = Array.from(doc.querySelectorAll(MERMAID_BLOCK_SELECTOR))
  if (blocks.length === 0) return html

  const figures = await Promise.all(
    blocks.map(async (block) => {
      const source = block.querySelector('pre code')?.textContent ?? ''
      let svg: string
      try {
        svg = await render(source)
      } catch {
        return null
      }
      const figure = doc.createElement('figure')
      figure.className = 'tvp-print-mermaid'
      figure.innerHTML = svg
      return figure
    }),
  )
  blocks.forEach((block, index) => {
    const figure = figures[index]
    if (figure) block.replaceWith(figure)
  })
  return doc.body.innerHTML
}

/**
 * 把 HTML 里的公式节点替换为 KaTeX MathML 输出,供打印 / 导出 PDF 使用。
 * 打印 iframe 不带编辑器样式,KaTeX HTML 依赖 CSS + 字体文件;MathML 由
 * 浏览器原生渲染,自包含零依赖(与 Mermaid 打印自包含 SVG 同一思路)。
 * 渲染失败的公式保留原节点源码,不阻塞导出流程。
 */
export async function inlineMathPrintHtml(
  html: string,
  options: InlineMathPrintHtmlOptions = {},
): Promise<string> {
  // 快速路径:没有公式节点时避免无谓的 DOMParser 解析
  if (!html.includes('data-type="math-')) return html
  const render = options.render
    ?? ((latex: string, displayMode: boolean) =>
      renderMathToString(latex, { displayMode, output: 'mathml' }))
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const nodes = Array.from(doc.querySelectorAll(MATH_NODE_SELECTOR))
  if (nodes.length === 0) return html

  await Promise.all(
    nodes.map(async (node) => {
      const latex = node.getAttribute('data-latex') ?? ''
      const displayMode = node.getAttribute('data-type') === 'math-block'
      try {
        node.innerHTML = await render(latex, displayMode)
      } catch {
        // 单个公式失败保留原样,不阻塞整篇打印
      }
    }),
  )
  return doc.body.innerHTML
}

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

// srcdoc 中的 <title> 来自开发者配置,可能动态拼接用户内容(如文档名),需转义防注入
function escapePrintTitle(title: string): string {
  return title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
    } catch {
      // 无头浏览器 / 测试环境没有打印能力,print() 可能抛错;导出是尽力而为,不阻塞清理
    } finally {
      setTimeout(cleanup, options.cleanupDelay ?? DEFAULT_PRINT_CLEANUP_DELAY)
    }
  }
  iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapePrintTitle(options.title ?? t('print.defaultTitle'))}</title>
<style>${PRINT_STYLES}</style>
</head><body>${html}</body></html>`
  setTimeout(cleanup, PRINT_FALLBACK_CLEANUP_MS)

  return iframe
}
