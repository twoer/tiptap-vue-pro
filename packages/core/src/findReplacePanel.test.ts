import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createFindReplaceState } from './findReplace'
import { useFindReplacePanelState } from './findReplacePanel'
import type { ProEditorContext } from './types'

describe('useFindReplacePanelState', () => {
  function setup() {
    const findReplaceState = ref(createFindReplaceState({
      open: true,
      query: 'alpha',
      replacement: 'beta',
      activeIndex: 1,
      matches: [
        { from: 1, to: 6, text: 'alpha' },
        { from: 8, to: 13, text: 'alpha' },
      ],
    }))
    const commands = {
      setFindReplaceQuery: vi.fn(),
      setFindReplaceReplacement: vi.fn(),
      setFindReplaceCaseSensitive: vi.fn((caseSensitive: boolean) => {
        findReplaceState.value = {
          ...findReplaceState.value,
          caseSensitive,
        }
      }),
    }
    const ctx = { findReplaceState, commands } as unknown as ProEditorContext
    return {
      findReplaceState,
      commands,
      panel: useFindReplacePanelState(() => ctx),
    }
  }

  it('derives match counters from the shared editor state', () => {
    const { panel, findReplaceState } = setup()

    expect(panel.total.value).toBe(2)
    expect(panel.current.value).toBe(2)

    findReplaceState.value = createFindReplaceState()

    expect(panel.total.value).toBe(0)
    expect(panel.current.value).toBe(0)
  })

  it('binds editable values to the editor commands', () => {
    const { panel, commands } = setup()

    panel.query.value = 'next'
    panel.replacement.value = 'value'
    panel.caseSensitive.value = true
    panel.toggleCaseSensitive()

    expect(commands.setFindReplaceQuery).toHaveBeenCalledWith('next')
    expect(commands.setFindReplaceReplacement).toHaveBeenCalledWith('value')
    expect(commands.setFindReplaceCaseSensitive).toHaveBeenNthCalledWith(1, true)
    expect(commands.setFindReplaceCaseSensitive).toHaveBeenNthCalledWith(2, false)
  })
})
