import { shallowRef } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useToolbarLinkController } from './toolbarLinkController'
import type { EditorLinkTarget } from './editorBehaviorOptions'
import type { ProEditorContext } from './types'

interface EditorOptions {
  empty?: boolean
  inLink?: boolean
  from?: number
  to?: number
}

function createEditor(options: EditorOptions = {}) {
  const from = options.from ?? 3
  const to = options.to ?? (options.empty === false ? 10 : from)
  const empty = options.empty ?? from === to
  const linkMarkType = { name: 'link' }
  const linkMark = {
    type: linkMarkType,
    attrs: { href: 'https://old.example.com', target: '_blank' },
    eq(other: unknown) {
      return other === linkMark
    },
  }
  const linkNode = { marks: [linkMark], nodeSize: 7 }
  const linkParent = {
    childCount: 1,
    child: vi.fn(() => linkNode),
    childAfter: vi.fn(() => ({ node: linkNode, index: 0, offset: 0 })),
    childBefore: vi.fn(() => ({ node: linkNode, index: 0, offset: 0 })),
  }
  const selection = {
    from,
    to,
    empty,
    $from: options.inLink
      ? {
          marks: () => [linkMark],
          parent: linkParent,
          parentOffset: 1,
          start: () => 3,
        }
      : undefined,
  }

  return {
    state: {
      schema: { marks: { link: linkMarkType } },
      selection,
      doc: {
        resolve: vi.fn(() => undefined),
        textBetween: vi.fn((rangeFrom: number, rangeTo: number) => (
          rangeFrom === 3 && rangeTo === 10 ? 'old link' : 'selected text'
        )),
      },
    },
    isActive: vi.fn((name: string) => name === 'link' && !!options.inLink),
    getAttributes: vi.fn((name: string) => (
      name === 'link' && options.inLink
        ? { href: 'https://old.example.com', target: '_blank' }
        : {}
    )),
  }
}

function setup(options: {
  editor?: ReturnType<typeof createEditor>
  defaultTarget?: EditorLinkTarget
  prepareInsert?: () => void
} = {}) {
  const commands = {
    insertLinkText: vi.fn(),
    setLink: vi.fn(),
  }
  const notify = vi.fn()
  const ctx = {
    editor: shallowRef(options.editor),
    commands,
    notify,
    t: (key: string) => key,
  } as unknown as ProEditorContext
  const prepareInsert = vi.fn(options.prepareInsert ?? (() => {}))
  const debugLog = vi.fn()
  const controller = useToolbarLinkController({
    getContext: () => ctx,
    prepareInsert,
    getDefaultTarget: () => options.defaultTarget ?? '_blank',
    debugLog,
  })

  return { controller, commands, notify, prepareInsert, debugLog }
}

describe('useToolbarLinkController', () => {
  it('does not open without an editor', () => {
    const { controller, prepareInsert, debugLog } = setup()

    controller.open()

    expect(controller.visible.value).toBe(false)
    expect(prepareInsert).not.toHaveBeenCalled()
    expect(debugLog).not.toHaveBeenCalled()
  })

  it('snapshots the selected range after insertion preparation', () => {
    const editor = createEditor({ from: 1, to: 1 })
    const { controller, commands } = setup({
      editor,
      prepareInsert: () => {
        editor.state.selection.from = 8
        editor.state.selection.to = 8
      },
    })

    controller.open()
    controller.url.value = 'https://example.com'
    controller.confirm()

    expect(commands.insertLinkText).toHaveBeenCalledWith(
      'https://example.com',
      '',
      { target: '_blank', range: { from: 8, to: 8 } },
    )
  })

  it('prefills the complete active link range and target', () => {
    const { controller, debugLog } = setup({
      editor: createEditor({ inLink: true }),
      defaultTarget: '_self',
    })

    controller.open()

    expect(controller.url.value).toBe('https://old.example.com')
    expect(controller.text.value).toBe('old link')
    expect(controller.newTab.value).toBe(true)
    expect(debugLog).toHaveBeenCalledWith('adapter', 'dialog-open', { dialog: 'link' })
  })

  it('inserts link text at the saved empty selection', () => {
    const { controller, commands } = setup({ editor: createEditor() })
    controller.open()
    controller.url.value = 'https://example.com'
    controller.text.value = 'Example'

    controller.confirm()

    expect(commands.insertLinkText).toHaveBeenCalledWith(
      'https://example.com',
      'Example',
      { target: '_blank', range: { from: 3, to: 3 } },
    )
    expect(controller.visible.value).toBe(false)
  })

  it('applies a link to selected text without replacing it', () => {
    const { controller, commands } = setup({
      editor: createEditor({ empty: false }),
    })
    controller.open()
    controller.url.value = 'https://example.com'
    controller.text.value = ''

    controller.confirm()

    expect(commands.setLink).toHaveBeenCalledWith(
      'https://example.com',
      { target: '_blank', range: { from: 3, to: 10 } },
    )
    expect(commands.insertLinkText).not.toHaveBeenCalled()
  })

  it('removes an active link when href is cleared', () => {
    const { controller, commands, notify } = setup({
      editor: createEditor({ inLink: true, empty: false }),
    })
    controller.open()
    controller.url.value = ''

    controller.confirm()

    expect(commands.setLink).toHaveBeenCalledWith(
      '',
      { target: '_blank', range: { from: 3, to: 10 } },
    )
    expect(notify).toHaveBeenCalledWith('notify.linkRemoved', 'success')
    expect(controller.visible.value).toBe(false)
  })

  it('warns for an empty new link and keeps the dialog open', () => {
    const { controller, commands, notify } = setup({ editor: createEditor() })
    controller.open()

    controller.confirm()

    expect(commands.setLink).not.toHaveBeenCalled()
    expect(commands.insertLinkText).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('notify.linkEmpty', 'warning')
    expect(controller.visible.value).toBe(true)
  })

  it('rejects invalid href values without changing the document', () => {
    const { controller, commands, notify } = setup({ editor: createEditor() })
    controller.open()
    controller.url.value = 'not-a-link'

    controller.confirm()

    expect(commands.setLink).not.toHaveBeenCalled()
    expect(commands.insertLinkText).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('notify.linkInvalid', 'warning')
    expect(controller.visible.value).toBe(true)
  })

  it('uses the configured default target and supports cancellation', () => {
    const { controller, commands, debugLog } = setup({
      editor: createEditor(),
      defaultTarget: '_self',
    })
    controller.open()
    controller.url.value = 'mailto:test@example.com'
    controller.confirm()

    expect(commands.insertLinkText).toHaveBeenCalledWith(
      'mailto:test@example.com',
      '',
      { target: '_self', range: { from: 3, to: 3 } },
    )
    expect(debugLog).toHaveBeenCalledWith('adapter', 'dialog-confirm', { dialog: 'link' })

    controller.open()
    controller.cancel()
    expect(controller.visible.value).toBe(false)
  })
})
