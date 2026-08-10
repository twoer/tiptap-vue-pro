import { ref } from 'vue'
import type { ProEditorDebugLogFn } from './debug'
import type { ProEditorContext } from './types'

export interface ToolbarImageUrlControllerOptions {
  getContext: () => ProEditorContext
  prepareInsert: () => void
  debugLog?: ProEditorDebugLogFn
}

function isSupportedImageUrl(value: string) {
  try {
    const parsed = new URL(value, 'http://tiptap-vue-pro.local')
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function useToolbarImageUrlController(
  options: ToolbarImageUrlControllerOptions,
) {
  const visible = ref(false)
  const url = ref('')

  function open() {
    options.prepareInsert()
    url.value = ''
    visible.value = true
    options.debugLog?.('adapter', 'dialog-open', { dialog: 'image-url' })
  }

  function confirm() {
    options.debugLog?.('adapter', 'dialog-confirm', { dialog: 'image-url' })
    const source = url.value.trim()

    if (!source) {
      visible.value = false
      return true
    }

    if (!isSupportedImageUrl(source)) {
      const ctx = options.getContext()
      ctx.notify(ctx.t('notify.invalidImageUrl'), 'warning')
      return false
    }

    options.getContext().commands.setImage(source)
    visible.value = false
    return true
  }

  return {
    visible,
    url,
    open,
    confirm,
  }
}
