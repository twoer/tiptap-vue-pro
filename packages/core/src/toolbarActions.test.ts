import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  inlineMathPrintHtml,
  exportMarkdownFile,
  importMarkdownFile,
  inlineMermaidSvg,
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

  it('embeds print page setup and pagination rules in the iframe document', () => {
    vi.useFakeTimers()
    const iframe = printEditorContent('<p>hello</p>', { cleanupDelay: 10 })

    const srcdoc = iframe.srcdoc
    expect(srcdoc).toContain('@page{size:A4;margin:18mm 16mm}')
    expect(srcdoc).toContain('print-color-adjust:exact')
    expect(srcdoc).toContain('ul[data-type="taskList"]')
    expect(srcdoc).toContain('break-inside:avoid')

    vi.useRealTimers()
  })

  it('escapes html-sensitive characters in the print title', () => {
    vi.useFakeTimers()
    const iframe = printEditorContent('<p>hello</p>', {
      cleanupDelay: 10,
      title: 'Notes & <b>Docs</b> "v1"',
    })

    const srcdoc = iframe.srcdoc
    expect(srcdoc).toContain('<title>Notes &amp; &lt;b&gt;Docs&lt;/b&gt; &quot;v1&quot;</title>')
    expect(srcdoc).not.toContain('<b>')

    vi.useRealTimers()
  })

  it('keeps html untouched when no mermaid block exists', async () => {
    const render = vi.fn(async () => '<svg></svg>')

    await expect(inlineMermaidSvg('<p>plain</p>', { render })).resolves.toBe('<p>plain</p>')
    expect(render).not.toHaveBeenCalled()
  })

  it('replaces mermaid blocks with rendered svg figures', async () => {
    const render = vi.fn(async (source: string) => `<svg data-source="${source}"></svg>`)
    const html = '<p>before</p><div data-type="mermaid-block"><pre><code class="language-mermaid">graph TD</code></pre></div>'

    const result = await inlineMermaidSvg(html, { render })

    expect(result).toContain('<p>before</p>')
    expect(result).toContain('figure class="tvp-print-mermaid"')
    expect(result).toContain('<svg data-source="graph TD"></svg>')
    expect(result).not.toContain('mermaid-block')
    expect(render).toHaveBeenCalledWith('graph TD')
  })

  it('keeps the source pre when a mermaid block fails to render', async () => {
    const render = vi.fn(async (source: string) => {
      if (source === 'broken') throw new Error('syntax error')
      return '<svg></svg>'
    })
    const html = '<div data-type="mermaid-block"><pre><code class="language-mermaid">broken</code></pre></div><div data-type="mermaid-block"><pre><code class="language-mermaid">works</code></pre></div>'

    const result = await inlineMermaidSvg(html, { render })

    expect(result).toContain('language-mermaid')
    expect(result).toContain('broken')
    expect(result).toContain('tvp-print-mermaid')
    expect(result).toContain('<svg></svg>')
  })

  it('keeps html untouched when no math node exists', async () => {
    const render = vi.fn(async () => '<math></math>')

    await expect(inlineMathPrintHtml('<p>plain</p>', { render })).resolves.toBe('<p>plain</p>')
    expect(render).not.toHaveBeenCalled()
  })

  it('replaces math nodes with mathml output, keeping the wrapper for print styles', async () => {
    const render = vi.fn(async (latex: string, displayMode: boolean) =>
      `<math data-latex="${latex}" data-display="${displayMode}"></math>`)
    const html = '<p>a <span data-type="math-inline" data-latex="x^2"></span> b</p>'
      + '<div data-type="math-block" data-latex="\\frac{1}{2}"></div>'

    const result = await inlineMathPrintHtml(html, { render })

    expect(result).toContain('data-type="math-inline"')
    expect(result).toContain('data-type="math-block"')
    expect(result).toContain('<math data-latex="x^2" data-display="false"></math>')
    expect(result).toContain('<math data-latex="\\frac{1}{2}" data-display="true"></math>')
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('keeps the original node when a formula fails to render', async () => {
    const render = vi.fn(async (latex: string) => {
      if (latex === 'broken') throw new Error('KaTeX parse error')
      return '<math></math>'
    })
    const html = '<span data-type="math-inline" data-latex="broken"></span>'
      + '<span data-type="math-inline" data-latex="ok"></span>'

    const result = await inlineMathPrintHtml(html, { render })

    expect(result).toContain('data-latex="broken"')
    expect(result).toContain('<math></math>')
  })
})
