import { shallowRef } from 'vue'
import type { ResolvedToolbarOptions } from './toolbarConfigData'
import {
  exportMarkdownFile,
  importMarkdownFile,
  inlineMathPrintHtml,
  inlineMermaidSvg,
  printEditorContent,
} from './toolbarActions'
import type { ProEditorContext } from './types'

export interface ToolbarDocumentActionsOptions {
  getContext: () => ProEditorContext
  getToolbarOptions: () => ResolvedToolbarOptions
}

export function useToolbarDocumentActions(options: ToolbarDocumentActionsOptions) {
  const markdownInput = shallowRef<HTMLInputElement | null>(null)

  function triggerImportMarkdown() {
    markdownInput.value?.click()
  }

  async function onMarkdownSelected(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    const ctx = options.getContext()
    await importMarkdownFile(ctx, file, { t: ctx.t })
  }

  function exportMarkdown() {
    const ctx = options.getContext()
    return exportMarkdownFile(ctx, {
      filename: options.getToolbarOptions().markdown.exportFilename,
      t: ctx.t,
    })
  }

  function runMarkdownAction(action: string) {
    if (action === 'import') triggerImportMarkdown()
    else if (action === 'export') exportMarkdown()
  }

  // 打印文档里没有编辑器上下文:Mermaid 源码 pre 先内联为 SVG,
  // 公式节点替换为自包含 MathML;两步各自失败都保留源码兜底,不互相阻塞
  async function toPrintableHtml(ctx: ProEditorContext): Promise<string> {
    let html = ctx.getHTML()
    try {
      html = await inlineMermaidSvg(html)
    } catch {
      // 保留原始 HTML
    }
    try {
      html = await inlineMathPrintHtml(html)
    } catch {
      // 保留原始 HTML
    }
    return html
  }

  async function printContent() {
    const ctx = options.getContext()
    const printOptions = options.getToolbarOptions().print
    // 浏览器没有静默生成 PDF 的公开 API,打印对话框是唯一入口;提示用户可选「另存为 PDF」拿到文件
    ctx.notify(ctx.t('notify.printExportHint'), 'info')
    const html = await toPrintableHtml(ctx)
    return printEditorContent(html, {
      ...printOptions,
      t: ctx.t,
      title: printOptions.title ?? ctx.t('print.defaultTitle'),
    })
  }

  return {
    markdownInput,
    triggerImportMarkdown,
    onMarkdownSelected,
    exportMarkdown,
    runMarkdownAction,
    printContent,
  }
}
