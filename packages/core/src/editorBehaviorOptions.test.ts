import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EDITOR_BEHAVIOR_OPTIONS,
  resolveEditorBehaviorOptions,
} from './editorBehaviorOptions'

describe('editor behavior options', () => {
  it('resolves default behavior options', () => {
    expect(resolveEditorBehaviorOptions()).toEqual(DEFAULT_EDITOR_BEHAVIOR_OPTIONS)
  })

  it('allows partial overrides without replacing unrelated defaults', () => {
    const options = resolveEditorBehaviorOptions({
      link: { defaultTarget: '_self' },
      image: { accept: 'image/png,image/jpeg' },
    })

    expect(options.link.defaultTarget).toBe('_self')
    expect(options.image.accept).toBe('image/png,image/jpeg')
    expect(options.table).toEqual(DEFAULT_EDITOR_BEHAVIOR_OPTIONS.table)
  })

  it('preserves explicit false for table header rows', () => {
    expect(resolveEditorBehaviorOptions({
      table: { withHeaderRow: false },
    }).table.withHeaderRow).toBe(false)
  })
})
