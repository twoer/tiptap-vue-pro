import { shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveToolbarOptions } from './toolbarConfigData'
import { useToolbarDocumentActions } from './toolbarDocumentActions'
import type { ProEditorContext } from './types'

const actionMocks = vi.hoisted(() => ({
  importMarkdownFile: vi.fn(),
  exportMarkdownFile: vi.fn(),
  printEditorContent: vi.fn(),
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

  it('forwards print title and cleanup options', () => {
    const { controller, ctx } = setup()

    controller.printContent()

    expect(actionMocks.printEditorContent).toHaveBeenCalledWith('<p>document</p>', {
      title: 'Project notes',
      cleanupDelay: 25,
      t: ctx.t,
    })
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
