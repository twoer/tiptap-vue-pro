import { describe, expect, it } from 'vitest'
import { DEFAULT_TOOLBAR, normalizeToolbarConfig } from './toolbar'

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
      ['link', 'image', 'attachment', 'table', 'hr'],
      ['markdown', 'print'],
      ['preview', 'fullscreen'],
    ])
  })
})
