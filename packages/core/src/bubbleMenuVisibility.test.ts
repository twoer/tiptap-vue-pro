import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'
import { shouldShowTextBubbleMenu } from './bubbleMenuVisibility'

function fakeState(overrides: {
  empty?: boolean
  ancestors?: string[]
}): EditorState {
  const names = overrides.ancestors ?? ['doc', 'paragraph']
  return {
    // 无 link mark 的最小 schema:getActiveLinkRange 直接返回 null
    schema: { marks: {} },
    selection: {
      empty: overrides.empty ?? false,
      from: 2,
      to: 5,
      $from: {
        depth: names.length - 1,
        node: (d: number) => ({ type: { name: names[d] ?? 'doc' } }),
      },
    },
  } as unknown as EditorState
}

function fakeEditor(state: EditorState): Editor {
  return {
    state,
  } as unknown as Editor
}

describe('shouldShowTextBubbleMenu', () => {
  it('空选区(纯光标)不显示', () => {
    const state = fakeState({ empty: true })
    expect(shouldShowTextBubbleMenu(fakeEditor(state), state)).toBe(false)
  })

  it('普通段落文字选区显示', () => {
    const state = fakeState({ ancestors: ['doc', 'paragraph'] })
    expect(shouldShowTextBubbleMenu(fakeEditor(state), state)).toBe(true)
  })

  it('表格单元格/表头内选文字不显示(表格气泡独占)', () => {
    const cell = fakeState({ ancestors: ['doc', 'table', 'tableRow', 'tableCell', 'paragraph'] })
    expect(shouldShowTextBubbleMenu(fakeEditor(cell), cell)).toBe(false)
    const header = fakeState({ ancestors: ['doc', 'table', 'tableRow', 'tableHeader', 'paragraph'] })
    expect(shouldShowTextBubbleMenu(fakeEditor(header), header)).toBe(false)
  })
})
