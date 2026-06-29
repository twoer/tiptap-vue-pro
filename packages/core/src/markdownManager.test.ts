import { describe, expect, it, vi } from 'vitest'
import { createMarkdownManager } from './markdownManager'

describe('createMarkdownManager', () => {
  it('returns empty markdown when the extension manager is missing', () => {
    const editor = {
      storage: {},
      getJSON: vi.fn(),
      commands: { setContent: vi.fn() },
    } as any

    const manager = createMarkdownManager(editor)

    expect(manager.exportMarkdown()).toBe('')
  })

  it('serializes through editor.storage.markdown.manager', () => {
    const serialize = vi.fn(() => '# Title')
    const editor = {
      storage: { markdown: { manager: { serialize } } },
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      commands: { setContent: vi.fn() },
    } as any

    const manager = createMarkdownManager(editor)

    expect(manager.exportMarkdown()).toBe('# Title')
    expect(serialize).toHaveBeenCalledWith({ type: 'doc', content: [] })
  })

  it('imports markdown through parse and setContent', () => {
    const json = { type: 'doc', content: [] }
    const parse = vi.fn(() => json)
    const setContent = vi.fn()
    const editor = {
      storage: { markdown: { manager: { parse, serialize: vi.fn() } } },
      getJSON: vi.fn(),
      commands: { setContent },
    } as any

    const manager = createMarkdownManager(editor)
    manager.importMarkdown('hello')

    expect(parse).toHaveBeenCalledWith('hello')
    expect(setContent).toHaveBeenCalledWith(json)
  })

  it('falls back to raw content when markdown parsing fails', () => {
    const parse = vi.fn(() => {
      throw new Error('bad markdown')
    })
    const setContent = vi.fn()
    const editor = {
      storage: { markdown: { manager: { parse, serialize: vi.fn() } } },
      getJSON: vi.fn(),
      commands: { setContent },
    } as any

    const manager = createMarkdownManager(editor)
    manager.importMarkdown('| broken |')

    expect(parse).toHaveBeenCalledWith('| broken |')
    expect(setContent).toHaveBeenCalledWith('| broken |')
  })

  it('imports raw content when the extension manager is missing', () => {
    const setContent = vi.fn()
    const editor = {
      storage: {},
      getJSON: vi.fn(),
      commands: { setContent },
    } as any

    const manager = createMarkdownManager(editor)
    manager.importMarkdown('plain text')

    expect(setContent).toHaveBeenCalledWith('plain text')
  })
})
