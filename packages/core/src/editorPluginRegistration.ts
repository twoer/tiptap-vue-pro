import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { Editor } from '@tiptap/vue-3'

type EditorPlugin = Parameters<Editor['registerPlugin']>[0]

export interface EditorPluginRegistrationOptions {
  getEditor: () => Editor | undefined
  getElement: () => HTMLElement | null
  pluginKey: string
  createPlugin: (editor: Editor, element: HTMLElement) => EditorPlugin
  onRegistered?: (editor: Editor, element: HTMLElement) => void | (() => void)
}

/**
 * Register a ProseMirror/Tiptap plugin against the current editor instance.
 *
 * UI adapters often receive editor asynchronously and may see it change during
 * HMR or option-driven re-creation. This helper keeps the plugin attached to
 * exactly one editor instance and unregisters it from the old instance.
 */
export function useEditorPluginRegistration(options: EditorPluginRegistrationOptions) {
  let registeredEditor: Editor | null = null
  let cleanupRegistered: (() => void) | null = null

  function unregisterPlugin() {
    const ed = registeredEditor
    if (!ed) return
    cleanupRegistered?.()
    cleanupRegistered = null
    ed.unregisterPlugin(options.pluginKey)
    registeredEditor = null
  }

  function registerPlugin() {
    const ed = options.getEditor()
    const element = options.getElement()
    if (!ed || !element) {
      unregisterPlugin()
      return
    }
    if (registeredEditor === ed) return
    unregisterPlugin()
    ed.registerPlugin(options.createPlugin(ed, element))
    cleanupRegistered = options.onRegistered?.(ed, element) ?? null
    registeredEditor = ed
  }

  onMounted(registerPlugin)
  watch(
    () => [options.getEditor(), options.getElement()] as const,
    () => registerPlugin(),
  )
  onBeforeUnmount(unregisterPlugin)

  return {
    registerPlugin,
    unregisterPlugin,
  }
}
