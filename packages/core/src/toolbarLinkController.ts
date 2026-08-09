import { ref } from 'vue'
import type { ProEditorDebugLogFn } from './debug'
import type { EditorLinkTarget } from './editorBehaviorOptions'
import { getActiveLinkRange } from './linkRange'
import type { ProEditorContext } from './types'

export interface ToolbarLinkControllerOptions {
  getContext: () => ProEditorContext
  prepareInsert: () => void
  getDefaultTarget: () => EditorLinkTarget
  debugLog?: ProEditorDebugLogFn
}

export function useToolbarLinkController(options: ToolbarLinkControllerOptions) {
  const visible = ref(false)
  const url = ref('')
  const text = ref('')
  const newTab = ref(true)
  let savedFrom = 0
  let savedTo = 0
  let savedEmpty = true
  let savedInLink = false

  function open() {
    const ctx = options.getContext()
    const editor = ctx.editor.value
    if (!editor) return

    options.debugLog?.('adapter', 'dialog-open', { dialog: 'link' })
    options.prepareInsert()

    const { from, to, empty } = editor.state.selection
    savedFrom = from
    savedTo = to
    savedEmpty = empty
    savedInLink = editor.isActive('link')

    const activeLink = getActiveLinkRange(editor)
    if (activeLink) {
      savedFrom = activeLink.from
      savedTo = activeLink.to
      savedEmpty = false
      url.value = activeLink.href
      text.value = activeLink.text
      newTab.value = activeLink.target
        ? activeLink.target === '_blank'
        : options.getDefaultTarget() === '_blank'
    } else {
      const attrs = editor.getAttributes('link') as { href?: string } | undefined
      url.value = attrs?.href ?? ''
      text.value = empty ? '' : editor.state.doc.textBetween(from, to, ' ')
      newTab.value = options.getDefaultTarget() === '_blank'
    }

    visible.value = true
  }

  function confirm() {
    const ctx = options.getContext()
    if (!ctx.editor.value) return

    options.debugLog?.('adapter', 'dialog-confirm', { dialog: 'link' })
    const href = url.value.trim()
    const displayText = text.value.trim()
    const target: EditorLinkTarget = newTab.value ? '_blank' : '_self'
    const range = { from: savedFrom, to: savedTo }

    if (!href) {
      if (savedInLink) {
        ctx.commands.setLink('', { target, range })
        ctx.notify(ctx.t('notify.linkRemoved'), 'success')
      } else {
        ctx.notify(ctx.t('notify.linkEmpty'), 'warning')
        return
      }
      visible.value = false
      return
    }

    if (!/^(https?:|mailto:|tel:)/i.test(href) && !/\.[a-z]{2,}/i.test(href)) {
      ctx.notify(ctx.t('notify.linkInvalid'), 'warning')
      return
    }

    if (savedEmpty || displayText) {
      ctx.commands.insertLinkText(href, displayText, { target, range })
    } else {
      ctx.commands.setLink(href, { target, range })
    }
    visible.value = false
  }

  function cancel() {
    visible.value = false
  }

  return {
    visible,
    url,
    text,
    newTab,
    open,
    confirm,
    cancel,
  }
}
