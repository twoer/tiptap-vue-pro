import { shallowRef } from 'vue'
import type { ResolvedToolbarOptions } from './toolbarConfigData'
import {
  exportMarkdownFile,
  importMarkdownFile,
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

  function printContent() {
    const ctx = options.getContext()
    const printOptions = options.getToolbarOptions().print
    return printEditorContent(ctx.getHTML(), {
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
