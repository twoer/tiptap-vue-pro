import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOOLBAR,
  normalizeToolbarConfig,
  resolveToolbarLayout,
} from './toolbar'

describe('toolbar config', () => {
  it('normalizes false into no groups', () => {
    expect(normalizeToolbarConfig(false)).toEqual([])
  })

  it('normalizes undefined into the default toolbar without sharing references', () => {
    const result = normalizeToolbarConfig(undefined)

    expect(result).toEqual(DEFAULT_TOOLBAR)
    expect(result).not.toBe(DEFAULT_TOOLBAR)
    expect(result[0]).not.toBe(DEFAULT_TOOLBAR[0])
  })

  it('keeps custom group order', () => {
    expect(normalizeToolbarConfig([['bold', 'italic'], ['link']])).toEqual([
      ['bold', 'italic'],
      ['link'],
    ])
  })

  it('drops empty groups', () => {
    expect(normalizeToolbarConfig([[], ['bold']])).toEqual([['bold']])
  })

  it('keeps the default toolbar grouped by common editor workflows', () => {
    expect(DEFAULT_TOOLBAR).toEqual([
      ['undo', 'redo'],
      ['heading', 'fontFamily', 'fontSize', 'lineHeight'],
      ['bold', 'italic', 'underline', 'strike', 'code', 'superscript', 'subscript'],
      ['color', 'highlight', 'clearFormat'],
      ['align', 'decreaseIndent', 'increaseIndent'],
      ['bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock'],
      ['link', 'image', 'attachment', 'table', 'mermaid', 'hr'],
      ['findReplace', 'markdown', 'print'],
      ['preview', 'fullscreen'],
    ])
  })

  it('keeps classic layout groups unchanged', () => {
    const toolbar = [['bold', 'strike'], ['image', 'preview']] as const

    expect(resolveToolbarLayout(toolbar.map((group) => [...group]), 'classic')).toEqual({
      mode: 'classic',
      groups: [['bold', 'strike'], ['image', 'preview']],
      menus: [],
      trailing: [],
    })
  })

  it('partitions compact layout without dropping configured commands', () => {
    const layout = resolveToolbarLayout(DEFAULT_TOOLBAR, 'compact')

    expect(layout).toEqual({
      mode: 'compact',
      groups: [
        ['undo', 'redo'],
        ['heading', 'fontFamily', 'fontSize', 'lineHeight'],
        ['bold', 'italic', 'underline'],
        ['color', 'highlight'],
        ['align'],
        ['codeBlock'],
        ['link', 'table'],
      ],
      menus: [
        { id: 'format', items: ['strike', 'code', 'superscript', 'subscript', 'clearFormat'] },
        { id: 'list', items: ['decreaseIndent', 'increaseIndent', 'bulletList', 'orderedList', 'taskList', 'blockquote'] },
        { id: 'insert', items: ['image', 'attachment', 'mermaid', 'hr'] },
        { id: 'more', items: ['findReplace', 'markdown', 'print'] },
      ],
      trailing: ['preview', 'fullscreen'],
    })

    const resolvedItems = [
      ...layout.groups.flat(),
      ...layout.menus.flatMap((menu) => menu.items),
      ...layout.trailing,
    ]
    expect(resolvedItems).toEqual(expect.arrayContaining(DEFAULT_TOOLBAR.flat()))
    expect(new Set(resolvedItems).size).toBe(new Set(DEFAULT_TOOLBAR.flat()).size)
  })

  it('omits empty compact menus and preserves configured item order inside a menu', () => {
    expect(resolveToolbarLayout([
      ['print', 'findReplace'],
      ['bold'],
      ['fullscreen'],
    ], 'compact')).toEqual({
      mode: 'compact',
      groups: [['bold']],
      menus: [{ id: 'more', items: ['print', 'findReplace'] }],
      trailing: ['fullscreen'],
    })
  })
})
