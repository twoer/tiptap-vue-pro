import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { describe, expect, it, vi } from 'vitest'
import {
  FindReplaceExtension,
  getFindReplaceActiveSelection,
  getFindReplacePluginState,
} from './findReplace'
import type { FindReplaceState } from '../findReplace'

function createFindReplaceEditor(onUpdate?: (state: FindReplaceState) => void) {
  return new Editor({
    extensions: [
      StarterKit,
      FindReplaceExtension.configure({ onUpdate }),
    ],
    content: '<p>Alpha beta alpha</p><p>ALPHA</p>',
  })
}

function createTableFindReplaceEditor() {
  const element = document.createElement('div')
  document.body.appendChild(element)
  const editor = new Editor({
    element,
    extensions: [
      StarterKit,
      TableKit,
      FindReplaceExtension,
    ],
    content:
      '<p>outside alpha</p>' +
      '<table><tbody><tr>' +
      '<td><p>cell alpha one</p></td>' +
      '<td><p>cell alpha two</p></td>' +
      '</tr></tbody></table>',
  })
  return { editor, element }
}

function runKey(editor: Editor, key: string, options: KeyboardEventInit = {}) {
  return editor.view.someProp('handleKeyDown', (handler) => (
    handler(editor.view, new KeyboardEvent('keydown', { key, ...options }))
  ))
}

describe('FindReplaceExtension', () => {
  it('opens with Mod-f and reports matches', () => {
    const onUpdate = vi.fn()
    const editor = createFindReplaceEditor(onUpdate)

    runKey(editor, 'f', { metaKey: true })
    editor.commands.setFindReplaceQuery('alpha')

    const state = getFindReplacePluginState(editor.state)
    expect(state.open).toBe(true)
    expect(state.query).toBe('alpha')
    expect(state.matches).toHaveLength(3)
    expect(state.activeIndex).toBe(0)
    expect(getFindReplaceActiveSelection(state)).toEqual({
      from: state.matches[0].from,
      to: state.matches[0].to,
    })
    expect(onUpdate).toHaveBeenCalled()

    editor.destroy()
  })

  it('supports case-sensitive matching', () => {
    const editor = createFindReplaceEditor()

    editor.commands.openFindReplace()
    editor.commands.setFindReplaceQuery('Alpha')
    expect(getFindReplacePluginState(editor.state).matches).toHaveLength(3)

    editor.commands.setFindReplaceCaseSensitive(true)
    expect(getFindReplacePluginState(editor.state).matches).toHaveLength(1)

    editor.destroy()
  })

  it('moves to next and previous matches', () => {
    const editor = createFindReplaceEditor()

    editor.commands.openFindReplace()
    editor.commands.setFindReplaceQuery('alpha')

    editor.commands.findReplaceNext()
    expect(getFindReplacePluginState(editor.state).activeIndex).toBe(1)

    editor.commands.findReplacePrevious()
    expect(getFindReplacePluginState(editor.state).activeIndex).toBe(0)

    editor.destroy()
  })

  it('focuses and selects matches inside table cells when navigating', () => {
    const { editor, element } = createTableFindReplaceEditor()

    editor.commands.openFindReplace()
    editor.commands.setFindReplaceQuery('alpha')
    const stateBefore = getFindReplacePluginState(editor.state)

    editor.view.dom.blur()
    editor.commands.findReplaceNext()

    const state = getFindReplacePluginState(editor.state)
    expect(state.activeIndex).toBe(1)
    expect(editor.state.selection.from).toBe(stateBefore.matches[1].from)
    expect(editor.state.selection.to).toBe(stateBefore.matches[1].to)
    expect(editor.isFocused).toBe(true)

    editor.destroy()
    element.remove()
  })

  it('replaces the active match and keeps remaining matches highlighted', () => {
    const editor = createFindReplaceEditor()

    editor.commands.openFindReplace()
    editor.commands.setFindReplaceQuery('alpha')
    editor.commands.setFindReplaceReplacement('omega')
    editor.commands.replaceFindReplaceCurrent()

    const state = getFindReplacePluginState(editor.state)
    expect(editor.getText()).toContain('omega beta alpha')
    expect(state.matches).toHaveLength(2)
    expect(state.replacement).toBe('omega')

    editor.destroy()
  })

  it('replaces all matches from the end of the document', () => {
    const editor = createFindReplaceEditor()

    editor.commands.openFindReplace()
    editor.commands.setFindReplaceQuery('alpha')
    editor.commands.replaceFindReplaceAll('omega')

    const state = getFindReplacePluginState(editor.state)
    expect(editor.getText()).toBe('omega beta omega\n\nomega')
    expect(state.matches).toHaveLength(0)

    editor.destroy()
  })

  it('Escape closes the panel and clears matches', () => {
    const editor = createFindReplaceEditor()

    editor.commands.openFindReplace()
    editor.commands.setFindReplaceQuery('alpha')
    runKey(editor, 'Escape')

    const state = getFindReplacePluginState(editor.state)
    expect(state.open).toBe(false)
    expect(state.matches).toHaveLength(0)

    editor.destroy()
  })
})
