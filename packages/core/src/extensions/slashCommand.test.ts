import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { describe, expect, it, vi } from 'vitest'
import { SlashCommandExtension, createSlashCommandExtension } from './slashCommand'
import type { SlashCommandRenderState } from './slashCommand'

function createSlashEditor(options: Parameters<typeof createSlashCommandExtension>[0] = {}) {
  return new Editor({
    extensions: [
      StarterKit,
      createSlashCommandExtension({
        enabled: true,
        ...options,
      }),
    ],
    content: '<p></p>',
  })
}

describe('SlashCommandExtension', () => {
  it('is disabled by default until an adapter bridge configures it', () => {
    expect(SlashCommandExtension.name).toBe('slashCommand')
    expect(SlashCommandExtension.options.enabled).toBe(false)
  })

  it('can be created with bridge callbacks', () => {
    const onOpen = vi.fn()
    const extension = createSlashCommandExtension({ enabled: true, onOpen })

    expect(extension.name).toBe('slashCommand')
    expect(extension.options.enabled).toBe(true)
    expect(extension.options.onOpen).toBe(onOpen)
  })

  it('opens with V2 slash items and updates the typed query', async () => {
    const states: SlashCommandRenderState[] = []
    const editor = createSlashEditor({
      onOpen: (state) => states.push(state),
      onUpdate: (state) => states.push(state),
    })

    editor.commands.insertContent('/表')
    await vi.waitFor(() => {
      expect(states[states.length - 1]?.query).toBe('表')
      expect(states[states.length - 1]?.items[0]?.id).toBe('table')
    })

    const lastState = states[states.length - 1]!
    expect(lastState.items[0].id).toBe('table')
    expect(lastState.selectedIndex).toBe(0)

    editor.destroy()
  })

  it('ArrowDown and ArrowUp move the selected executable item', async () => {
    const states: SlashCommandRenderState[] = []
    const editor = createSlashEditor({
      onOpen: (state) => states.push(state),
      onUpdate: (state) => states.push(state),
    })

    editor.commands.insertContent('/')
    await vi.waitFor(() => {
      expect(states[states.length - 1]?.items.length).toBeGreaterThan(1)
    })

    editor.view.someProp('handleKeyDown', (handler) => (
      handler(editor.view, new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    ))
    expect(states[states.length - 1]?.selectedIndex).toBe(1)

    editor.view.someProp('handleKeyDown', (handler) => (
      handler(editor.view, new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    ))
    expect(states[states.length - 1]?.selectedIndex).toBe(0)

    editor.destroy()
  })

  it('Enter deletes the slash range before executing the selected command', async () => {
    const states: SlashCommandRenderState[] = []
    let executeHtml = ''
    const editor = createSlashEditor({
      onOpen: (state) => states.push(state),
      onUpdate: (state) => states.push(state),
      onExecute: ({ editor: executingEditor, item }) => {
        expect(item.id).toBe('table')
        executeHtml = executingEditor.getHTML()
      },
    })

    editor.commands.insertContent('/表')
    await vi.waitFor(() => {
      expect(editor.getText()).toBe('/表')
      expect(states[states.length - 1]?.items[0]?.id).toBe('table')
    })

    editor.view.someProp('handleKeyDown', (handler) => (
      handler(editor.view, new KeyboardEvent('keydown', { key: 'Enter' }))
    ))

    expect(executeHtml).toBe('<p></p>')
    expect(editor.getText()).toBe('')

    editor.destroy()
  })

  it('Escape closes the menu without deleting typed slash text', async () => {
    const onClose = vi.fn()
    const editor = createSlashEditor({ onClose })

    editor.commands.insertContent('/表')
    await vi.waitFor(() => {
      expect(editor.getText()).toBe('/表')
    })

    editor.view.someProp('handleKeyDown', (handler) => (
      handler(editor.view, new KeyboardEvent('keydown', { key: 'Escape' }))
    ))

    expect(onClose).toHaveBeenCalled()
    expect(editor.getText()).toBe('/表')

    editor.destroy()
  })
})
