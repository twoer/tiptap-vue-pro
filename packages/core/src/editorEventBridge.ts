import { ref, watch, type Ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'

/**
 * Bridge Tiptap editor events into Vue reactivity for adapter toolbars.
 *
 * Tiptap's selection/transaction state is internal to ProseMirror, so Vue will
 * not re-render active toolbar buttons unless we bump a ref on editor events.
 */
export function useEditorEventBridge(editor: Ref<Editor | undefined>) {
  const selectionTick = ref(0)
  const editorHasBeenFocused = ref(false)

  watch(
    editor,
    (ed, _oldEd, onCleanup) => {
      if (!ed) return
      const refreshSelection = () => {
        selectionTick.value++
      }
      const markFocused = () => {
        editorHasBeenFocused.value = true
      }
      ed.on('selectionUpdate', refreshSelection)
      ed.on('transaction', refreshSelection)
      ed.on('focus', markFocused)
      onCleanup(() => {
        ed.off('selectionUpdate', refreshSelection)
        ed.off('transaction', refreshSelection)
        ed.off('focus', markFocused)
      })
    },
    { immediate: true },
  )

  return {
    selectionTick,
    editorHasBeenFocused,
  }
}
