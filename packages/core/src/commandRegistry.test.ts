import { describe, expect, it, vi } from 'vitest'
import {
  COMMAND_GROUPS,
  COMMAND_REGISTRY,
  getActiveHeadingLevel,
  getActiveTextAlign,
  getCommandMeta,
  isToolbarCommandActive,
  runToolbarCommand,
} from './commandRegistry'
import { DEFAULT_TOOLBAR } from './toolbar'
import type { ProEditorContext } from './types'

function createCtx(active: Array<string | Record<string, unknown>> = []) {
  const commands = {
    undo: vi.fn(),
    redo: vi.fn(),
    bold: vi.fn(),
    italic: vi.fn(),
    strike: vi.fn(),
    underline: vi.fn(),
    code: vi.fn(),
    superscript: vi.fn(),
    subscript: vi.fn(),
    toggleHeading: vi.fn(),
    setFontFamily: vi.fn(),
    setFontSize: vi.fn(),
    setLineHeight: vi.fn(),
    setColor: vi.fn(),
    toggleHighlight: vi.fn(),
    align: vi.fn(),
    decreaseIndent: vi.fn(),
    increaseIndent: vi.fn(),
    bulletList: vi.fn(),
    orderedList: vi.fn(),
    taskList: vi.fn(),
    blockquote: vi.fn(),
    codeBlock: vi.fn(),
    hr: vi.fn(),
    clearFormat: vi.fn(),
  }
  const isActive = vi.fn((nameOrAttrs: string | Record<string, unknown>, attrs?: Record<string, unknown>) =>
    active.some((item) => {
      if (typeof item === 'string') return item === nameOrAttrs
      return JSON.stringify(item) === JSON.stringify(attrs ?? nameOrAttrs)
    }),
  )

  return {
    commands,
    isActive,
  } as unknown as ProEditorContext & { commands: typeof commands; isActive: typeof isActive }
}

describe('command registry', () => {
  it('contains metadata for every default toolbar command', () => {
    for (const group of COMMAND_GROUPS) {
      for (const command of group) {
        expect(COMMAND_REGISTRY[command]).toBeTruthy()
      }
    }
  })

  it('returns command metadata by id', () => {
    expect(getCommandMeta('bold')).toMatchObject({
      id: 'bold',
      label: '加粗',
      icon: 'Bold',
    })
  })

  it('uses the default toolbar as command groups', () => {
    expect(COMMAND_GROUPS).toBe(DEFAULT_TOOLBAR)
  })

  it('keeps registry keys and default toolbar ids in sync', () => {
    const toolbarIds = new Set(DEFAULT_TOOLBAR.flat())
    const registryIds = new Set(Object.keys(COMMAND_REGISTRY))

    expect(registryIds).toEqual(toolbarIds)
  })

  it('keeps each metadata id aligned with its registry key', () => {
    for (const [key, meta] of Object.entries(COMMAND_REGISTRY)) {
      expect(meta.id).toBe(key)
      expect(meta.label.length).toBeGreaterThan(0)
    }
  })

  it('runs registered simple editor commands', () => {
    const ctx = createCtx()

    expect(runToolbarCommand(ctx, 'bold')).toBe(true)
    expect(runToolbarCommand(ctx, 'clearFormat')).toBe(true)

    expect(ctx.commands.bold).toHaveBeenCalledTimes(1)
    expect(ctx.commands.clearFormat).toHaveBeenCalledTimes(1)
  })

  it('runs registered parameterized editor commands', () => {
    const ctx = createCtx()

    runToolbarCommand(ctx, 'heading', 2)
    runToolbarCommand(ctx, 'fontFamily', 'Arial')
    runToolbarCommand(ctx, 'fontSize', '16px')
    runToolbarCommand(ctx, 'lineHeight', '1.6')
    runToolbarCommand(ctx, 'align', 'center')
    runToolbarCommand(ctx, 'color', '#111111')
    runToolbarCommand(ctx, 'highlight', '#eeeeee')
    runToolbarCommand(ctx, 'codeBlock', 'typescript')

    expect(ctx.commands.toggleHeading).toHaveBeenCalledWith(2)
    expect(ctx.commands.setFontFamily).toHaveBeenCalledWith('Arial')
    expect(ctx.commands.setFontSize).toHaveBeenCalledWith('16px')
    expect(ctx.commands.setLineHeight).toHaveBeenCalledWith('1.6')
    expect(ctx.commands.align).toHaveBeenCalledWith('center')
    expect(ctx.commands.setColor).toHaveBeenCalledWith('#111111')
    expect(ctx.commands.toggleHighlight).toHaveBeenCalledWith('#eeeeee')
    expect(ctx.commands.codeBlock).toHaveBeenCalledWith('typescript')
  })

  it('returns false for commands that are adapter-owned UI actions', () => {
    const ctx = createCtx()

    expect(runToolbarCommand(ctx, 'link')).toBe(false)
    expect(runToolbarCommand(ctx, 'markdown')).toBe(false)
    expect(runToolbarCommand(ctx, 'fullscreen')).toBe(false)
  })

  it('reports active inline, heading, list, and alignment states', () => {
    const ctx = createCtx(['bold', 'bulletList', { level: 3 }, { textAlign: 'right' }])

    expect(isToolbarCommandActive(ctx, 'bold')).toBe(true)
    expect(isToolbarCommandActive(ctx, 'italic')).toBe(false)
    expect(isToolbarCommandActive(ctx, 'bulletList')).toBe(true)
    expect(isToolbarCommandActive(ctx, 'heading', 3)).toBe(true)
    expect(isToolbarCommandActive(ctx, 'align', 'right')).toBe(true)
  })

  it('derives active heading and alignment labels from editor state', () => {
    const ctx = createCtx([{ level: 4 }, { textAlign: 'justify' }])

    expect(getActiveHeadingLevel(ctx)).toBe(4)
    expect(getActiveTextAlign(ctx)).toBe('justify')
  })
})
