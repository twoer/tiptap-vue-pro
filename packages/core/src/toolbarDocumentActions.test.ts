import { shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveToolbarOptions } from './toolbarConfigData'
import { useToolbarDocumentActions } from './toolbarDocumentActions'
import type { ProEditorContext } from './types'

const actionMocks = vi.hoisted(() => ({
  importMarkdownFile: vi.fn(),
  exportMarkdownFile: vi.fn(),
  printEditorContent: vi.fn(),
  inlineMermaidSvg: vi.fn(async (html: string) => html),
  inlineMathPrintHtml: vi.fn(async (html: string) => html),
}))

vi.mock('./toolbarActions', () => actionMocks)

function inputWithFile(file?: File) {
  const input = document.createElement('input')
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: file ? [file] : [],
  })
  Object.defineProperty(input, 'value', {
    configurable: true,
    writable: true,
    value: 'selected',
  })
  return input
}

function setup() {
  const ctx = {
    editor: shallowRef(),
    getHTML: vi.fn(() => '<p>document</p>'),
    getMarkdown: vi.fn(() => '# document'),
    importMarkdown: vi.fn(),
    notify: vi.fn(),
    t: vi.fn((key: string) => key),
  } as unknown as ProEditorContext
  const toolbarOptions = resolveToolbarOptions({
    markdown: { exportFilename: () => 'notes.md' },
    print: { title: 'Project notes', cleanupDelay: 25 },
  })
  const controller = useToolbarDocumentActions({
    getContext: () => ctx,
    getToolbarOptions: () => toolbarOptions,
  })

  return { controller, ctx }
}

describe('useToolbarDocumentActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionMocks.inlineMermaidSvg.mockImplementation(async (html: string) => html)
    actionMocks.inlineMathPrintHtml.mockImplementation(async (html: string) => html)
  })

  it('opens the Markdown file input', () => {
    const { controller } = setup()
    const input = document.createElement('input')
    const click = vi.spyOn(input, 'click')
    controller.markdownInput.value = input

    controller.triggerImportMarkdown()

    expect(click).toHaveBeenCalledTimes(1)
  })

  it('clears the input before importing the selected Markdown file', async () => {
    let finishImport: (() => void) | undefined
    actionMocks.importMarkdownFile.mockImplementation(() => new Promise<void>((resolve) => {
      finishImport = resolve
    }))
    const { controller, ctx } = setup()
    const file = new File(['# title'], 'title.md', { type: 'text/markdown' })
    const input = inputWithFile(file)

    const pending = controller.onMarkdownSelected({ target: input } as unknown as Event)

    expect(input.value).toBe('')
    expect(actionMocks.importMarkdownFile).toHaveBeenCalledWith(ctx, file, { t: ctx.t })
    finishImport?.()
    await pending
  })

  it('forwards the configured export filename', () => {
    const { controller, ctx } = setup()

    controller.exportMarkdown()

    expect(actionMocks.exportMarkdownFile).toHaveBeenCalledWith(ctx, {
      filename: expect.any(Function),
      t: ctx.t,
    })
    const options = actionMocks.exportMarkdownFile.mock.calls[0]?.[1]
    expect(options?.filename()).toBe('notes.md')
  })

  it('notifies the save-as-pdf hint and forwards print options', async () => {
    const { controller, ctx } = setup()

    await controller.printContent()

    expect(ctx.notify).toHaveBeenCalledWith('notify.printExportHint', 'info')
    expect(actionMocks.printEditorContent).toHaveBeenCalledWith('<p>document</p>', {
      title: 'Project notes',
      cleanupDelay: 25,
      t: ctx.t,
    })
  })

  it('falls back to the raw html when mermaid inlining fails', async () => {
    const { controller } = setup()
    actionMocks.inlineMermaidSvg.mockRejectedValueOnce(new Error('renderer unavailable'))

    await controller.printContent()

    expect(actionMocks.inlineMermaidSvg).toHaveBeenCalledWith('<p>document</p>')
    expect(actionMocks.printEditorContent).toHaveBeenCalledWith(
      '<p>document</p>',
      expect.objectContaining({ title: 'Project notes' }),
    )
  })

  it('prints the html with both mermaid and math inlined', async () => {
    const { controller } = setup()
    actionMocks.inlineMermaidSvg.mockImplementation(async () => '<p>mermaid-svg</p>')
    actionMocks.inlineMathPrintHtml.mockImplementation(async () => '<p>mermaid-svg + mathml</p>')

    await controller.printContent()

    // 两步串行:公式替换拿到的是 Mermaid 内联后的产物
    expect(actionMocks.inlineMathPrintHtml).toHaveBeenCalledWith('<p>mermaid-svg</p>')
    expect(actionMocks.printEditorContent).toHaveBeenCalledWith(
      '<p>mermaid-svg + mathml</p>',
      expect.objectContaining({ title: 'Project notes' }),
    )
  })

  it('keeps the mermaid-inlined html when math inlining fails', async () => {
    const { controller } = setup()
    actionMocks.inlineMermaidSvg.mockImplementation(async () => '<p>mermaid-svg</p>')
    actionMocks.inlineMathPrintHtml.mockRejectedValueOnce(new Error('katex unavailable'))

    await controller.printContent()

    expect(actionMocks.printEditorContent).toHaveBeenCalledWith(
      '<p>mermaid-svg</p>',
      expect.objectContaining({ title: 'Project notes' }),
    )
  })

  it('routes import and export command keys', () => {
    const { controller } = setup()
    const input = document.createElement('input')
    const click = vi.spyOn(input, 'click')
    controller.markdownInput.value = input

    controller.runMarkdownAction('import')
    controller.runMarkdownAction('export')
    controller.runMarkdownAction('unknown')

    expect(click).toHaveBeenCalledTimes(1)
    expect(actionMocks.exportMarkdownFile).toHaveBeenCalledTimes(1)
  })
})
