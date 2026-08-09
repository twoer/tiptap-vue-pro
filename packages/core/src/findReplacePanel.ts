import { computed } from 'vue'
import type { ProEditorContext } from './types'

export function useFindReplacePanelState(getContext: () => ProEditorContext) {
  const state = computed(() => getContext().findReplaceState.value)
  const total = computed(() => state.value.matches.length)
  const current = computed(() => total.value > 0 ? state.value.activeIndex + 1 : 0)
  const query = computed({
    get: () => state.value.query,
    set: (value: string) => getContext().commands.setFindReplaceQuery(value),
  })
  const replacement = computed({
    get: () => state.value.replacement,
    set: (value: string) => getContext().commands.setFindReplaceReplacement(value),
  })
  const caseSensitive = computed({
    get: () => state.value.caseSensitive,
    set: (value: boolean) => getContext().commands.setFindReplaceCaseSensitive(value),
  })

  function toggleCaseSensitive() {
    caseSensitive.value = !caseSensitive.value
  }

  return {
    state,
    total,
    current,
    query,
    replacement,
    caseSensitive,
    toggleCaseSensitive,
  }
}
