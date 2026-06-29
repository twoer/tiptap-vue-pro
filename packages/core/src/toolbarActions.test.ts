import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  exportMarkdownFile,
  importMarkdownFile,
  printEditorContent,
} from './toolbarActions'

function createCtx(markdown = '# hello') {
  return {
    getMarkdown: vi.fn(() => markdown),
    importMarkdown: vi.fn(),
    notify: vi.fn(),
  }
}

describe('toolbarActions', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(123)
    URL.createObjectURL = vi.fn(() => 'blob:markdown')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.useRealTimers()
  })

  it('imports markdown file content and notifies success', async () => {
    const ctx = createCtx()
    const file = new File(['# title'], 'doc.md', { type: 'text/markdown' })

    await importMarkdownFile(ctx, file)

    expect(ctx.importMarkdown).toHaveBeenCalledWith('# title')
    expect(ctx.notify).toHaveBeenCalledWith('已导入 Markdown', 'success')
  })

  it('notifies when markdown file cannot be read', async () => {
    const ctx = createCtx()
    const file = {
      text: vi.fn(async () => {
        throw new Error('read failed')
      }),
    } as unknown as File

    await importMarkdownFile(ctx, file)

    expect(ctx.importMarkdown).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('导入失败:无法读取该文件', 'error')
  })

  it('exports markdown to a downloaded blob', () => {
    const ctx = createCtx('# hello')
    const click = vi.fn()
    let anchor: HTMLAnchorElement | undefined
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement
      if (tagName === 'a') {
        anchor = element as HTMLAnchorElement
        Object.defineProperty(element, 'click', { value: click })
      }
      return element
    })

    expect(exportMarkdownFile(ctx)).toBe(true)

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchor?.download).toBe('content-123.md')
    expect(click).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:markdown')
  })

  it('exports markdown with a custom filename', () => {
    const ctx = createCtx('# hello')
    let anchor: HTMLAnchorElement | undefined
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement
      if (tagName === 'a') {
        anchor = element as HTMLAnchorElement
        Object.defineProperty(element, 'click', { value: vi.fn() })
      }
      return element
    })

    expect(exportMarkdownFile(ctx, { filename: () => 'project-notes.md' })).toBe(true)

    expect(anchor?.download).toBe('project-notes.md')
  })

  it('warns when markdown export is unavailable', () => {
    const ctx = createCtx('')

    expect(exportMarkdownFile(ctx)).toBe(false)

    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(ctx.notify).toHaveBeenCalledWith('当前未启用 Markdown 能力,无法导出', 'warning')
  })

  it('prints editor html in an isolated iframe and cleans it up after load', () => {
    vi.useFakeTimers()
    const iframe = printEditorContent('<p>hello</p>', { cleanupDelay: 10 })
    const print = vi.fn()
    Object.defineProperty(iframe.contentWindow, 'print', {
      configurable: true,
      value: print,
    })

    expect(document.body.contains(iframe)).toBe(true)
    expect(iframe.contentWindow?.document.body.innerHTML).toContain('<p>hello</p>')

    iframe.onload?.(new Event('load'))

    expect(print).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10)
    expect(document.body.contains(iframe)).toBe(false)
  })
})
